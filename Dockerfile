# Use Node 18.19-alpine as it's the latest LTS version of Node 18
FROM node:18.19-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files for better layer caching
COPY package.json package-lock.json ./
RUN npm ci

# Builder stage
FROM base AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Disable telemetry during build
ENV NEXT_TELEMETRY_DISABLED 1

# Generate Prisma client and build the application
RUN npx prisma generate
RUN npm run build

# Production stage
FROM base AS runner
WORKDIR /app

# Set production environment
ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# Install required packages
RUN apk add --no-cache \
    curl \
    postgresql-client

# Create scripts directory
RUN mkdir -p /app/scripts

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy necessary files
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma

# Install and generate Prisma client before switching user
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
RUN npm install @prisma/client && \
    npx prisma generate

# Set proper permissions
RUN chown -R nextjs:nodejs /app && \
    chmod -R 755 /app

# Copy scripts and set permissions
COPY docker/wait-for-db.sh docker/entrypoint.sh /app/scripts/
RUN chown -R nextjs:nodejs /app/scripts && \
    chmod +x /app/scripts/wait-for-db.sh /app/scripts/entrypoint.sh

USER nextjs

ENTRYPOINT ["/app/scripts/entrypoint.sh"]

# Expose the port the app runs on
EXPOSE 3000

# Set host to allow connections from outside the container
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# Start the application
CMD ["node", "server.js"]
