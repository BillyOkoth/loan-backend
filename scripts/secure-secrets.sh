#!/bin/bash

# Secure secrets management script
set -e

# Create secrets directory if it doesn't exist
mkdir -p secrets
chmod 700 secrets

# Function to securely store a secret
store_secret() {
    local key=$1
    local value=$2
    echo "$value" > "./secrets/${key}.txt"
    chmod 600 "./secrets/${key}.txt"
}

# Function to extract value from .env
get_env_value() {
    local key=$1
    grep "^${key}=" .env | cut -d '=' -f2- | tr -d '"'"'"
}

# Function to convert to lowercase (macOS compatible)
to_lower() {
    echo "$1" | tr '[:upper:]' '[:lower:]'
}

# List of sensitive keys to migrate
SENSITIVE_KEYS=(
    "AI_API_KEY"
    "POSTGRES_PASSWORD"
    "PGADMIN_DEFAULT_PASSWORD"
    "GRAFANA_ADMIN_PASSWORD"
)

# Migrate secrets
echo "Migrating sensitive data to secure storage..."
for key in "${SENSITIVE_KEYS[@]}"; do
    value=$(get_env_value "$key")
    if [ ! -z "$value" ]; then
        store_secret "$(to_lower "$key")" "$value"
        echo "✓ Migrated $key"
    fi
done

# Create secure docker-compose override
cat > docker-compose.secrets.yml << EOL
version: '3.8'

services:
  loan-backend:
    secrets:
      - ai_api_key
      - postgres_password
    environment:
      - AI_API_KEY_FILE=/run/secrets/ai_api_key
      - POSTGRES_PASSWORD_FILE=/run/secrets/postgres_password

  postgres:
    secrets:
      - postgres_password
    environment:
      - POSTGRES_PASSWORD_FILE=/run/secrets/postgres_password

  pgadmin:
    secrets:
      - pgadmin_default_password
    environment:
      - PGADMIN_DEFAULT_PASSWORD_FILE=/run/secrets/pgadmin_default_password

  grafana:
    secrets:
      - grafana_admin_password
    environment:
      - GF_SECURITY_ADMIN_PASSWORD_FILE=/run/secrets/grafana_admin_password

secrets:
EOL

# Add secrets configuration
for key in "${SENSITIVE_KEYS[@]}"; do
    lower_key=$(to_lower "$key")
    echo "  ${lower_key}:" >> docker-compose.secrets.yml
    echo "    file: ./secrets/${lower_key}.txt" >> docker-compose.secrets.yml
done

echo "Created docker-compose.secrets.yml"

# Create a clean .env without sensitive data
if [ -f .env ]; then
    cp .env .env.backup
    echo "Backed up existing .env to .env.backup"
    
    # Remove sensitive data from .env
    for key in "${SENSITIVE_KEYS[@]}"; do
        sed -i.bak "/^${key}=/d" .env
    done
    rm -f .env.bak
fi

echo "
✅ Setup complete!

To run with secure secrets:
docker compose -f docker-compose.yml -f docker-compose.secrets.yml up -d

Your sensitive data is now stored in:
- Individual files in ./secrets/ (git-ignored)
- Mounted as Docker secrets
- Removed from .env

The original .env is backed up as .env.backup"