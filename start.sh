#!/bin/sh

# Railway startup script with debugging

echo "========================================="
echo "Starting Nutritionist App on Railway"
echo "========================================="
echo "Environment:"
echo "  NODE_ENV: ${NODE_ENV}"
echo "  PORT: ${PORT}"
echo "  DATABASE_PATH: ${DATABASE_PATH}"
echo "  PWD: $(pwd)"
echo "========================================="

# Check if database exists
if [ ! -f /data/database.sqlite ]; then
  echo "Database not found at /data/database.sqlite"
  
  if [ -f /tmp/database.sqlite ]; then
    echo "Found seed database at /tmp/database.sqlite"
    echo "Copying to /data/database.sqlite..."
    cp /tmp/database.sqlite /data/database.sqlite
    echo "Database copied successfully"
  else
    echo "No seed database found, app will create new database"
  fi
else
  echo "Database exists at /data/database.sqlite"
fi

# List files to verify structure
echo "========================================="
echo "Directory structure:"
ls -la
echo "========================================="

# Set DATABASE_PATH explicitly
export DATABASE_PATH=/data/database.sqlite

# Force binding to all interfaces for Railway
export HOSTNAME=0.0.0.0

# Start the server
echo "Starting Next.js server on 0.0.0.0:${PORT:-3000}..."
exec node server.js