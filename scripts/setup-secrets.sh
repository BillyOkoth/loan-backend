#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

# Create secrets directory if it doesn't exist
mkdir -p secrets
chmod 700 secrets

# Create .env if it doesn't exist
if [ ! -f .env ]; then
    cp env.example .env
    chmod 600 .env
    echo -e "${GREEN}Created .env file from template${NC}"
fi

# Function to safely update .env
update_env() {
    local key=$1
    local value=$2
    if grep -q "^${key}=" .env; then
        sed -i.bak "s|^${key}=.*|${key}=${value}|" .env
    else
        echo "${key}=${value}" >> .env
    fi
}

# Function to safely store a secret
store_secret() {
    local key=$1
    local value=$2
    echo "$value" > "./secrets/${key}.txt"
    chmod 600 "./secrets/${key}.txt"
}

echo -e "\n${GREEN}Secure Secret Management${NC}"
echo "This script helps manage sensitive configuration safely."
echo "Secrets will be stored in the ./secrets directory with restricted permissions."

# OpenAI API Key
read -p "Enter OpenAI API Key (press enter to skip): " API_KEY
if [ ! -z "$API_KEY" ]; then
    store_secret "ai_api_key" "$API_KEY"
    update_env "AI_API_KEY" "$API_KEY"
    echo -e "${GREEN}✓ Stored OpenAI API Key${NC}"
fi

# Database Password
read -p "Enter Database Password (press enter to skip): " DB_PASS
if [ ! -z "$DB_PASS" ]; then
    store_secret "postgres_password" "$DB_PASS"
    update_env "POSTGRES_PASSWORD" "$DB_PASS"
    echo -e "${GREEN}✓ Stored Database Password${NC}"
fi

echo -e "\n${GREEN}Setup Complete!${NC}"
echo "Your secrets are stored in:"
echo "- Individual files in ./secrets/ (git-ignored)"
echo "- Environment variables in .env (git-ignored)"
echo -e "\nTo use these secrets with Docker:"
echo "docker compose --env-file .env up -d"
