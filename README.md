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
   # Edit .env with your actual credentials and API keys
   # ⚠️ IMPORTANT: Never commit .env files to version control
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

### Environment Variables Setup

⚠️ **Security Notice**: Never commit `.env` files to version control. The `.env` file contains sensitive information like API keys and database passwords.

#### 1. **Create Environment File**
```bash
cp env.example .env
```

#### 2. **Configure Required Variables**
Edit the `.env` file with your actual values:

```env
# Application Configuration
NODE_ENV=development
PORT=3000

# Database Type (oracle | postgres)
DATABASE_TYPE=postgres

# PostgreSQL + pgvector Configuration
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=loanapp
POSTGRES_USER=admin
POSTGRES_PASSWORD=your_secure_password_here

# AI Configuration
AI_MODEL_ENDPOINT=https://api.openai.com/v1/embeddings
AI_API_KEY=your_actual_openai_api_key_here

# pgAdmin Configuration
PGADMIN_DEFAULT_EMAIL=admin@loanapp.com
PGADMIN_DEFAULT_PASSWORD=your_secure_pgadmin_password_here
```

#### 3. **Required Variables to Update**
- `POSTGRES_PASSWORD`: Use a strong, unique password
- `AI_API_KEY`: Your actual OpenAI API key
- `PGADMIN_DEFAULT_PASSWORD`: Secure password for pgAdmin access

#### 4. **Environment-Specific Files**
For different environments, create separate files:
- `.env.development` - Development environment
- `.env.test` - Testing environment  
- `.env.production` - Production environment
- `.env.staging` - Staging environment

#### 5. **Production Security**
For production deployments:
- Use environment-specific secret management
- Rotate passwords regularly
- Use strong, unique passwords for each service
- Consider using Docker secrets or Kubernetes secrets

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

### Using Docker Compose (Recommended)

1. **Setup Environment**
   ```bash
   cp env.example .env
   # Edit .env with your actual values
   ```

2. **Start Services**
   ```bash
   docker-compose up -d
   ```

3. **Access Services**
   - Application: http://localhost:3000
   - pgAdmin: http://localhost:8080
   - PostgreSQL: localhost:5432
   - **Prometheus**: http://localhost:9090
   - **Grafana**: http://localhost:3001 (admin/admin123)

### Manual Docker Deployment

```bash
# Build image
docker build -t loan-backend .

# Run container with environment file
docker run -p 3000:3000 --env-file .env loan-backend

# Or run with individual environment variables
docker run -p 3000:3000 \
  -e NODE_ENV=production \
  -e POSTGRES_HOST=your_db_host \
  -e POSTGRES_PASSWORD=your_password \
  -e AI_API_KEY=your_api_key \
  loan-backend
```

### Production Docker Deployment

For production, use Docker secrets or environment variables:

```bash
# Using Docker secrets
docker run -p 3000:3000 \
  --secret db_password \
  --secret api_key \
  loan-backend

# Using environment variables
docker run -p 3000:3000 \
  -e POSTGRES_PASSWORD=$(cat /path/to/db_password) \
  -e AI_API_KEY=$(cat /path/to/api_key) \
  loan-backend
```

## 📊 Monitoring & Observability

### Prometheus & Grafana Setup

The application includes comprehensive monitoring with Prometheus and Grafana:

#### **Metrics Endpoint**
- **Prometheus Metrics**: `http://localhost:3000/metrics`
- **Available Metrics**:
  - HTTP request rate and duration
  - Error rates by status code
  - Memory and CPU usage
  - Active connections
  - Loan application counts
  - Customer registration counts

#### **Monitoring Dashboards**
- **Grafana**: http://localhost:3001
  - Default credentials: `admin/admin123`
  - Pre-configured dashboard: "Loan Backend Monitoring"
  - Real-time metrics visualization

#### **Prometheus Configuration**
- **Prometheus**: http://localhost:9090
- Scrapes metrics every 15 seconds
- Stores data for 200 hours
- Monitors application, database, and system metrics

#### **Custom Metrics**
The application exposes custom business metrics:
- `loan_applications_total` - Total loan applications by status
- `customer_registrations_total` - Customer registration count
- `http_requests_total` - HTTP request counts by method/route/status
- `http_request_duration_seconds` - Response time histograms

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
- **Environment Variables**: Never commit `.env` files to version control
- **Secrets Management**: Use secure secret management for production
- **Database Security**: Use strong passwords and secure connections

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
