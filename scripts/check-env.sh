#!/bin/bash

# Check if OpenAI API key is set
if [ -z "$AI_API_KEY" ]; then
    echo "Error: AI_API_KEY environment variable is not set"
    echo "Please set it with: export AI_API_KEY=your_openai_api_key"
    exit 1
fi

# Update container environment
docker compose exec loan-backend sh -c "export AI_API_KEY=$AI_API_KEY"

echo "Environment checked and updated successfully"
