#!/bin/bash

echo "🚀 Setting up Loan Backend with Docker Compose"

# Stop and remove existing containers
echo "📦 Stopping existing containers..."
docker stop pgvector-dev pgadmin loan-backend-app 2>/dev/null || true
docker rm pgvector-dev pgadmin loan-backend-app 2>/dev/null || true

# Create .env file for local development
echo "📝 Creating .env file for local development..."
cat > .env << EOF
# Application Configuration
NODE_ENV=development
PORT=3000

# Database Type (oracle | postgres)
DATABASE_TYPE=postgres

# Oracle 23ai Configuration
ORACLE_HOST=localhost
ORACLE_PORT=1521
ORACLE_USER=your_oracle_user
ORACLE_PASSWORD=your_oracle_password
ORACLE_SID=XEPDB1
ORACLE_SERVICE_NAME=XEPDB1
ORACLE_CONNECTION_STRING=localhost:1521/XEPDB1

# PostgreSQL + pgvector Configuration (Docker Compose)
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=loanapp
POSTGRES_USER=admin
POSTGRES_PASSWORD=EllaZanzi

# TypeORM Configuration
SYNCHRONIZE=true
LOGGING=true

# AI Configuration
AI_MODEL_ENDPOINT=https://api.openai.com/v1/embeddings
AI_API_KEY=sk-your-openai-api-key-here

# Vector Database Configuration
VECTOR_DIMENSION=1536
VECTOR_TABLE_PREFIX=loan_vectors

# Logging
LOG_LEVEL=debug
EOF

echo "✅ .env file created successfully!"

# Start PostgreSQL and pgAdmin
echo "🐘 Starting PostgreSQL with pgvector..."
docker-compose -f docker-compose.dev.yml up -d postgres pgadmin

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 10

# Test database connection
echo "🧪 Testing database connection..."
docker exec pgvector-dev psql -U admin -d loanapp -c "SELECT version();" 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✅ Database connection successful!"
else
    echo "❌ Database connection failed. Please check the logs."
    docker logs pgvector-dev
    exit 1
fi

echo ""
echo "🎉 Setup complete! You can now:"
echo "1. Start the application: npm run start:dev"
echo "2. Access pgAdmin at: http://localhost:8080"
echo "   - Email: admin@loanapp.com"
echo "   - Password: admin123"
echo "3. Database connection details:"
echo "   - Host: localhost"
echo "   - Port: 5432"
echo "   - Database: loanapp"
echo "   - Username: admin"
echo "   - Password: EllaZanzi"
echo ""
echo "📊 To view logs: docker logs pgvector-dev"
echo "🛑 To stop: docker-compose -f docker-compose.dev.yml down"
