#!/bin/sh
set -e

if [ -z "$DATABASE_URL" ]; then
    echo "ERROR: DATABASE_URL environment variable is not set"
    exit 1
fi

# Parse database URL to get host
DB_HOST=$(echo $DATABASE_URL | awk -F[@//] '{print $4}' | cut -d: -f1)

echo "Checking database connection..."
if ! /app/scripts/wait-for-db.sh "$DB_HOST"; then
    echo "ERROR: Failed to connect to database"
    exit 1
fi

echo "Running database migrations..."
if ! npx prisma migrate deploy; then
    echo "ERROR: Failed to run database migrations"
    exit 1
fi

echo "Database migrations completed successfully"
echo "Starting the application..."
exec "$@"
