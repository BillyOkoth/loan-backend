# Loan Backend Application

A comprehensive NestJS-based loan management system with AI-powered features, supporting both Oracle 23ai and PostgreSQL + pgvector databases.

## 🚀 Features

### Core Functionality
- **Customer Management** - Full CRUD operations with validation
- **Loan Processing** - Complete loan lifecycle management
- **AI-Powered Analysis** - Risk assessment and loan recommendations
- **Vector Search** - Similar loan finding using embeddings

### Database Support
- **Oracle 23ai** - Native vector operations with `dbms_vector_chain.utl_to_embedding`
- **PostgreSQL + pgvector** - Vector similarity search and storage
- **Dynamic Configuration** - Switch between databases via environment variables

### AI Features
- **Loan Analysis** - AI-powered application analysis
- **Risk Assessment** - Automated risk scoring
- **Vector Embeddings** - Text-to-vector conversion
- **Similarity Search** - Find similar loans using vector operations
- **Loan Recommendations** - AI-generated recommendations

## 📁 Project Structure

```
backend/
├── src/
│   ├── app.module.ts
│   ├── main.ts
│   ├── config/
│   │   ├── database.strategy.ts  # Strategy pattern for DB connections
│   │   ├── oracle.service.ts     # Oracle 23ai implementation
│   │   ├── postgres.service.ts   # PostgreSQL + pgvector implementation
│   ├── customer/
│   │   ├── customer.controller.ts
│   │   ├── customer.service.ts
│   │   ├── dto/
│   ├── loan/
│   │   ├── loan.controller.ts
│   │   ├── loan.service.ts
│   │   ├── dto/
│   ├── ai/
│   │   ├── ai.controller.ts
│   │   └── ai.service.ts
│   ├── entities/                 # TypeORM entities
│   │   ├── client.entity.ts
│   │   ├── loan-application.entity.ts
│   │   └── ... (12 entities total)
├── ormconfig.ts                  # TypeORM configuration
├── .env                          # Environment configuration
└── Dockerfile
```

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/BillyOkoth/loan-backend.git
   cd loan-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp env.example .env
   # Edit .env with your database credentials
   ```

4. **Start the application**
   ```bash
   npm run start:dev
   ```

## 🗄️ Database Setup

### PostgreSQL + pgvector (Docker)
```bash
# Run PostgreSQL with pgvector
docker run -d \
  --name pgvector-dev \
  -e POSTGRES_USER=admin \
  -e POSTGRES_PASSWORD=EllaZanzi \
  -e POSTGRES_DB=loanapp \
  -p 5432:5432 \
  ankane/pgvector
```

### Oracle 23ai
- Install Oracle 23ai with vector capabilities
- Configure connection string in `.env`

## 🔧 Configuration

### Environment Variables
```env
# Database Type
DATABASE_TYPE=postgres  # or oracle

# PostgreSQL Configuration
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=loanapp
POSTGRES_USER=admin
POSTGRES_PASSWORD=EllaZanzi

# Oracle Configuration
ORACLE_HOST=localhost
ORACLE_PORT=1521
ORACLE_USER=your_user
ORACLE_PASSWORD=your_password
ORACLE_SID=XEPDB1

# AI Configuration
AI_API_KEY=your_openai_api_key
AI_MODEL_ENDPOINT=https://api.openai.com/v1/embeddings
```

## 📡 API Endpoints

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

### AI Features
- `POST /ai/analyze-loan` - Analyze loan application
- `POST /ai/generate-embedding` - Generate text embeddings
- `POST /ai/vector-search` - Search similar vectors
- `POST /ai/store-vector` - Store vector data
- `GET /ai/similar-loans/:loanId` - Find similar loans
- `POST /ai/risk-assessment` - Assess customer risk
- `POST /ai/loan-recommendation` - Get loan recommendations

## 🐳 Docker Deployment

```bash
# Build image
docker build -t loan-backend .

# Run container
docker run -p 3000:3000 --env-file .env loan-backend
```

## 🧪 Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## 📊 Database Schema

The application includes 12 entities following the PostgreSQL schema:
- `clients` - Customer information
- `loan_applications` - Loan applications
- `client_debt` - Customer debt information
- `mock_loan_data` - Mock loan data
- `loan_chunk` - Vector embeddings
- `clients_to_loan_recommendations` - Loan recommendations
- And 6 additional entities for complete loan management

## 🔒 Security

- Input validation using class-validator
- Environment-based configuration
- Secure database connections
- API key management for AI services

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 👨‍💻 Author

**Billy Okoth**
- GitHub: [@BillyOkoth](https://github.com/BillyOkoth)
- Website: [www.masaicode.com](https://www.masaicode.com)
