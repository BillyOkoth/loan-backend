# Loan Backend Setup

This document provides instructions for setting up the loan backend application with the configured folder structure.

## Folder Structure

```
backend/
├── src/
│   ├── app.module.ts
│   ├── main.ts
│   ├── config/
│   │   ├── database.strategy.ts  # uses strategy pattern
│   │   ├── oracle.service.ts     # Oracle 23ai implementation
│   │   ├── postgres.service.ts   # PostgreSQL + pgvector implementation
│   ├── customer/
│   │   ├── customer.controller.ts
│   │   ├── customer.service.ts
│   │   ├── dto/
│   │   │   ├── index.ts
│   │   │   ├── create-customer.dto.ts
│   │   │   └── update-customer.dto.ts
│   ├── loan/
│   │   ├── loan.controller.ts
│   │   ├── loan.service.ts
│   │   ├── dto/
│   │   │   ├── index.ts
│   │   │   ├── create-loan.dto.ts
│   │   │   └── update-loan.dto.ts
│   ├── ai/
│   │   ├── ai.controller.ts
│   │   └── ai.service.ts
├── .env
└── Dockerfile
```

## Environment Configuration

Create a `.env` file in the root directory with the following variables:

```env
# Application Configuration
NODE_ENV=development
PORT=3000

# Database Configuration
# Oracle 23ai
ORACLE_USER=your_oracle_user
ORACLE_PASSWORD=your_oracle_password
ORACLE_CONNECTION_STRING=localhost:1521/XEPDB1

# PostgreSQL + pgvector
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=loan_backend
POSTGRES_USER=your_postgres_user
POSTGRES_PASSWORD=your_postgres_password

# AI Configuration
AI_MODEL_ENDPOINT=https://api.openai.com/v1/embeddings
AI_API_KEY=your_openai_api_key

# Vector Database Configuration
VECTOR_DIMENSION=1536
VECTOR_TABLE_PREFIX=loan_vectors

# Logging
LOG_LEVEL=debug
```

## Features Implemented

### 1. Database Strategy Pattern
- **`database.strategy.ts`**: Implements the strategy pattern for database connections
- **`oracle.service.ts`**: Oracle 23ai implementation with vector search capabilities
- **`postgres.service.ts`**: PostgreSQL + pgvector implementation for vector operations

### 2. Customer Management
- **CRUD Operations**: Create, read, update, delete customers
- **Validation**: DTOs with class-validator decorators
- **Pagination**: Support for paginated customer lists
- **Loan History**: Get customer loan history

### 3. Loan Management
- **Loan Processing**: Create and manage loan applications
- **Status Management**: Pending, approved, rejected, active, completed, defaulted
- **Payment Calculations**: Automatic monthly payment and total amount calculations
- **Approval Workflow**: Approve/reject loans with reasons

### 4. AI-Powered Features
- **Loan Analysis**: AI-powered loan application analysis
- **Risk Assessment**: Automated risk scoring and assessment
- **Vector Search**: Similar loan finding using embeddings
- **Loan Recommendations**: AI-generated loan recommendations
- **Embedding Generation**: Text to vector embeddings

## API Endpoints

### Customers
- `POST /customers` - Create customer
- `GET /customers` - Get all customers (paginated)
- `GET /customers/:id` - Get customer by ID
- `PUT /customers/:id` - Update customer
- `DELETE /customers/:id` - Delete customer
- `GET /customers/:id/loans` - Get customer loans

### Loans
- `POST /loans` - Create loan
- `GET /loans` - Get all loans (paginated)
- `GET /loans/:id` - Get loan by ID
- `PUT /loans/:id` - Update loan
- `DELETE /loans/:id` - Delete loan
- `POST /loans/:id/approve` - Approve loan
- `POST /loans/:id/reject` - Reject loan
- `GET /loans/customer/:customerId` - Get loans by customer

### AI
- `POST /ai/analyze-loan` - Analyze loan application
- `POST /ai/generate-embedding` - Generate text embeddings
- `POST /ai/vector-search` - Search similar vectors
- `POST /ai/store-vector` - Store vector data
- `GET /ai/similar-loans/:loanId` - Find similar loans
- `POST /ai/risk-assessment` - Assess customer risk
- `POST /ai/loan-recommendation` - Get loan recommendations

## Installation

1. Install dependencies:
```bash
npm install
```

2. Create environment file:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Start development server:
```bash
npm run start:dev
```

## Docker Deployment

Build and run with Docker:

```bash
# Build image
docker build -t loan-backend .

# Run container
docker run -p 3000:3000 --env-file .env loan-backend
```

## Database Setup

### PostgreSQL + pgvector
1. Install PostgreSQL with pgvector extension
2. Create database: `loan_backend`
3. Enable vector extension: `CREATE EXTENSION vector;`

### Oracle 23ai
1. Install Oracle 23ai with vector capabilities
2. Configure connection string
3. Create vector-enabled tables

## Next Steps

1. Implement actual database connections
2. Add authentication and authorization
3. Implement real AI model integrations
4. Add comprehensive error handling
5. Implement logging and monitoring
6. Add unit and integration tests
7. Set up CI/CD pipeline
