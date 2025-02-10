#!/bin/sh
# wait-for-db.sh

set -e

# Extract database connection details from DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
    echo "DATABASE_URL is not set"
    exit 1
fi

# Parse connection details from DATABASE_URL
DB_HOST="$1"
DB_USER=$(echo $DATABASE_URL | awk -F[:@//] '{print $4}')
DB_PASS=$(echo $DATABASE_URL | awk -F[:@//] '{print $5}')
DB_NAME=$(echo $DATABASE_URL | awk -F[/] '{print $NF}' | cut -d? -f1)

echo "Waiting for PostgreSQL to be ready..."
until PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c '\q' 2>/dev/null; do
    echo "PostgreSQL is unavailable - sleeping"
    sleep 1
done

echo "PostgreSQL is up and ready!"
