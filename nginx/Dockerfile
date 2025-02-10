FROM nginx:alpine

# Install required packages
RUN apk add --no-cache \
    curl \
    su-exec

# Create necessary directories
RUN mkdir -p /var/cache/nginx \
             /var/run \
             /var/log/nginx \
             /etc/nginx/conf.d \
             /usr/local/nginx/conf

# Copy nginx configuration to writable location
COPY nginx.conf /usr/local/nginx/conf/nginx.conf

# Forward nginx logs to docker log collector
RUN ln -sf /dev/stdout /var/log/nginx/access.log && \
    ln -sf /dev/stderr /var/log/nginx/error.log

# Set proper permissions
RUN chown -R nginx:nginx /var/cache/nginx \
                        /var/run \
                        /var/log/nginx \
                        /usr/local/nginx && \
    chmod -R 755 /var/cache/nginx \
                 /var/run \
                 /var/log/nginx \
                 /usr/local/nginx

# Create pid file with proper permissions
RUN touch /var/run/nginx.pid && \
    chown nginx:nginx /var/run/nginx.pid

# Add entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["nginx", "-c", "/usr/local/nginx/conf/nginx.conf", "-g", "daemon off;"]
