#!/bin/bash

# Directory for secrets
mkdir -p secrets
chmod 700 secrets

# Create .env if it doesn't exist
if [ ! -f .env ]; then
    cp env.example .env
    chmod 600 .env
fi

# Development: Update .env
update_env() {
    local key=$1
    local value=$2
    if grep -q "^${key}=" .env; then
        sed -i.bak "s|^${key}=.*|${key}=${value}|" .env
    else
        echo "${key}=${value}" >> .env
    fi
}

# Production: Update Docker secret
update_secret() {
    local key=$1
    local value=$2
    echo "$value" > "./secrets/${key}.txt"
    chmod 600 "./secrets/${key}.txt"
}

# Usage
echo "Environment: ${NODE_ENV:-development}"
read -p "Enter OpenAI API Key: " API_KEY

if [ "${NODE_ENV}" = "production" ]; then
    update_secret "openai_api_key" "$API_KEY"
    echo "Updated Docker secret"
else
    update_env "AI_API_KEY" "$API_KEY"
    echo "Updated .env file"
fi

echo "Done! Use 'docker compose up -d' to apply changes"
