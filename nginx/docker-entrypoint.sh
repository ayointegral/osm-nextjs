#!/bin/sh
set -e

# Ensure proper permissions for nginx directories
chown -R nginx:nginx /var/cache/nginx \
                    /var/run \
                    /var/log/nginx \
                    /usr/local/nginx

# Start nginx as nginx user using su-exec
exec su-exec nginx "$@"
