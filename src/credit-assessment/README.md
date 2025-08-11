# Credit Assessment Module

## Overview
The Credit Assessment Module implements a comprehensive credit scoring system tailored for the Kenyan financial context. It evaluates creditworthiness using multiple data sources including bank statements, M-Pesa transactions, SACCO membership, and other Kenyan-specific financial indicators.

## Features

### ✅ Phase 1 Implementation Complete
- **Database Infrastructure**: Complete schema for credit assessment data
- **File Upload System**: Secure document upload with validation
- **Document Processing**: Basic PDF/CSV parsing capabilities
- **Credit Scoring Engine**: Kenyan-specific scoring algorithm
- **API Endpoints**: Complete REST API for credit assessment operations

## Database Schema

### Core Tables
- `financial_documents` - Document storage and metadata
- `transaction_history` - Unified transaction data from all sources
- `kenyan_credit_factors` - Kenyan-specific credit factors
- `credit_assessments` - Assessment history and results
- `customer_references` - Reference verification data
- `document_processing_queue` - Background processing queue

## API Endpoints

### Document Management
- `POST /api/credit-assessment/upload-document` - Upload financial documents
- `GET /api/credit-assessment/documents/:customerId` - Get customer documents
- `DELETE /api/credit-assessment/document/:documentId` - Delete document

### Credit Assessment
- `POST /api/credit-assessment/assess/:customerId` - Perform credit assessment
- `GET /api/credit-assessment/score/:customerId` - Get latest credit score
- `GET /api/credit-assessment/history/:customerId` - Get assessment history
- `GET /api/credit-assessment/summary/:customerId` - Get assessment summary

### Credit Factors
- `GET /api/credit-assessment/factors/:customerId` - Get Kenyan credit factors
- `PUT /api/credit-assessment/factors/:customerId` - Update credit factors

### Risk Analysis
- `GET /api/credit-assessment/risk-analysis/:customerId` - Get risk analysis

### References
- `POST /api/credit-assessment/reference/:customerId` - Add customer reference
- `GET /api/credit-assessment/references/:customerId` - Get customer references

### System
- `GET /api/credit-assessment/stats` - Get system statistics
- `GET /api/credit-assessment/health` - Health check

## Credit Scoring Algorithm

### Kenyan-Specific Weights
- **Payment History**: 25% - Traditional payment history
- **M-Pesa Consistency**: 20% - M-Pesa usage patterns
- **SACCO Membership**: 15% - SACCO participation
- **Income Stability**: 15% - Employment/business stability
- **Community Trust**: 10% - Community references
- **Asset Ownership**: 10% - Land/property ownership
- **Digital Adoption**: 5% - Digital payment adoption

### Score Range
- **300-850**: Credit score range
- **Risk Levels**: 
  - Low (700+)
  - Medium (600-699)
  - High (500-599)
  - Very High (300-499)

## Supported Document Types

### Primary Documents
- **Bank Statements** (PDF/CSV)
- **M-Pesa Statements** (PDF)
- **SACCO Statements** (PDF/CSV)
- **Payslips** (PDF/Image)
- **Business Registration** (PDF/Image)
- **Title Deeds** (PDF/Image)

### File Specifications
- **Max Size**: 10MB
- **Formats**: PDF, CSV, JPG, PNG
- **Security**: File type validation, virus scanning
- **Storage**: Secure local storage with unique filenames

## Background Processing

### Automated Tasks
- **Document Processing**: Every 5 minutes
- **Scheduled Assessments**: Every hour
- **Queue Management**: Automatic retry and error handling

### Processing Pipeline
1. File Upload → Validation → Storage
2. Document Type Detection → Parser Selection
3. Data Extraction → Normalization → Validation
4. Transaction Categorization → Storage
5. Credit Score Recalculation → Update
6. Notification → Dashboard Update

## Usage Examples

### Upload a Bank Statement
```bash
curl -X POST \
  http://localhost:3000/api/credit-assessment/upload-document \
  -H 'Content-Type: multipart/form-data' \
  -F 'file=@bank_statement.pdf' \
  -F 'customerId=CUST001' \
  -F 'documentType=bank_statement'
```

### Perform Credit Assessment
```bash
curl -X POST \
  http://localhost:3000/api/credit-assessment/assess/CUST001
```

### Get Credit Score
```bash
curl -X GET \
  http://localhost:3000/api/credit-assessment/score/CUST001
```

## Configuration

### Environment Variables
```env
# File Upload
MAX_FILE_SIZE=10485760  # 10MB
UPLOAD_DIR=./uploads/documents

# Processing
QUEUE_PROCESSING_INTERVAL=300000  # 5 minutes
ASSESSMENT_INTERVAL=3600000       # 1 hour
```

### Security Features
- File type validation
- File size limits
- Secure file naming (UUID)
- Input validation and sanitization
- SQL injection prevention
- Rate limiting ready

## Monitoring Integration

### Prometheus Metrics
- Document processing metrics
- Credit score distribution
- Assessment success rates
- Processing queue metrics

### Grafana Dashboards
- Credit assessment performance
- Document processing analytics
- Risk distribution analysis

## Error Handling

### Document Processing Errors
- Invalid file format
- Corrupted files
- Processing timeouts
- Extraction failures

### API Error Responses
- 400: Bad Request (invalid input)
- 404: Not Found (customer/document not found)
- 413: Payload Too Large (file size limit)
- 415: Unsupported Media Type (invalid file type)
- 500: Internal Server Error

## Testing

### Unit Tests
```bash
npm test
```

### Integration Tests
```bash
npm run test:e2e
```

### Manual Testing
1. Upload various document types
2. Verify processing pipeline
3. Test credit score calculation
4. Validate API responses

## Future Enhancements (Phase 2-6)

### Phase 2: Advanced Document Processing
- OCR for scanned documents
- Advanced pattern recognition
- Multi-language support

### Phase 3: Enhanced AI/ML
- Machine learning models
- Anomaly detection
- Predictive analytics

### Phase 4: External Integrations
- Credit bureau integration
- Real-time data feeds
- Third-party verification

## Support

For issues or questions:
1. Check the logs: `docker-compose logs loan-backend`
2. Verify database connectivity
3. Test API endpoints with health check
4. Review processing queue status

## Dependencies

### Core Dependencies
- `@nestjs/common` - NestJS framework
- `@nestjs/typeorm` - Database ORM
- `multer` - File upload handling
- `pdf-parse` - PDF document parsing
- `csv-parser` - CSV file parsing

### Security Dependencies
- `uuid` - Secure file naming
- `class-validator` - Input validation
- `class-transformer` - Data transformation

## Architecture

```
Credit Assessment Module
├── Controllers/
│   └── credit-assessment.controller.ts
├── Services/
│   ├── credit-assessment.service.ts
│   ├── file-upload.service.ts
│   ├── document-processing.service.ts
│   └── credit-scoring.service.ts
├── Entities/
│   ├── financial-documents.entity.ts
│   ├── transaction-history.entity.ts
│   ├── kenyan-credit-factors.entity.ts
│   ├── credit-assessments.entity.ts
│   ├── customer-references.entity.ts
│   └── document-processing-queue.entity.ts
└── Migrations/
    └── CreateCreditAssessmentTables.ts
```

This module provides a complete foundation for credit assessment operations and is ready for production deployment with proper monitoring and security measures.
