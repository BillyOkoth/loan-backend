import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from '../../app.module';
import { DocumentType } from '../../entities/financial-documents.entity';

describe('Document Processing (e2e)', () => {
  let app: INestApplication;
  const testFilesDir = path.join(__dirname, '../../../test/sample-documents');

  beforeAll(async () => {
    // Create test files directory if it doesn't exist
    if (!fs.existsSync(testFilesDir)) {
      fs.mkdirSync(testFilesDir, { recursive: true });
    }

    // Create sample bank statement PDF
    const bankStatementContent = `
      BANK STATEMENT
      Account Number: 1234567890
      Account Name: John Doe
      Statement Period: 01/01/2023 - 31/01/2023

      Date        Description                     Amount      Balance
      01/01/2023  Opening Balance                            50,000.00
      05/01/2023  SALARY PAYMENT                 45,000.00   95,000.00
      10/01/2023  MPESA TRANSFER                -10,000.00   85,000.00
      15/01/2023  ELECTRICITY BILL KPLC         -2,500.00    82,500.00
      20/01/2023  ATM WITHDRAWAL                -5,000.00    77,500.00
      25/01/2023  GROCERY SHOPPING NAIVAS       -3,500.00    74,000.00
      31/01/2023  Closing Balance                            74,000.00
    `;
    fs.writeFileSync(path.join(testFilesDir, 'bank-statement.txt'), bankStatementContent);

    // Create sample M-Pesa statement
    const mpesaStatementContent = `
      M-PESA STATEMENT
      Phone Number: +254712345678
      Name: JOHN DOE
      Statement Period: 01/01/2023 - 31/01/2023

      Date        Description                              Amount    Balance
      01/01/2023  Send Money to +254723456789 JANE DOE    -1,000    9,000
      05/01/2023  Received From +254734567890 SALARY      5,000    14,000
      10/01/2023  Pay Bill KPLC TOKEN                    -2,500    11,500
      15/01/2023  Withdrawal at AGENT XYZ                -5,000     6,500
      20/01/2023  Buy Goods NAIVAS SUPERMARKET          -3,500     3,000
    `;
    fs.writeFileSync(path.join(testFilesDir, 'mpesa-statement.txt'), mpesaStatementContent);

    // Create sample SACCO statement
    const saccoStatementContent = `
      SACCO STATEMENT
      Member Number: SACCO123
      Member Name: John Doe
      Join Date: 01/01/2020
      Statement Period: 01/01/2023 - 31/01/2023

      Date        Description                     Amount      Shares    Balance
      01/01/2023  Opening Balance                                      100,000.00
      05/01/2023  Monthly Contribution            5,000.00   50        105,000.00
      10/01/2023  Loan Disbursement             50,000.00             155,000.00
      15/01/2023  Loan Repayment               -10,000.00             145,000.00
      20/01/2023  Share Purchase                 5,000.00   50        150,000.00
      31/01/2023  Closing Balance                                     150,000.00
    `;
    fs.writeFileSync(path.join(testFilesDir, 'sacco-statement.txt'), saccoStatementContent);

    // Create test module
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    // Clean up test files
    const testFiles = [
      'bank-statement.txt',
      'mpesa-statement.txt',
      'sacco-statement.txt'
    ];

    testFiles.forEach(file => {
      const filePath = path.join(testFilesDir, file);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });

    await app.close();
  });

  describe('Document Upload and Processing', () => {
    it('should upload and process bank statement', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/credit-assessment/upload-document')
        .attach('file', path.join(testFilesDir, 'bank-statement.txt'))
        .field('customerId', '12345')
        .field('documentType', DocumentType.BANK_STATEMENT)
        .field('additionalData', JSON.stringify({
          bankName: 'Test Bank',
          accountType: 'Savings'
        }));

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('documentId');
      expect(response.body.processingStatus).toBe('QUEUED');
    });

    it('should upload and process M-Pesa statement', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/credit-assessment/upload-document')
        .attach('file', path.join(testFilesDir, 'mpesa-statement.txt'))
        .field('customerId', '12345')
        .field('documentType', DocumentType.MPESA_STATEMENT)
        .field('additionalData', JSON.stringify({
          phoneNumber: '+254712345678'
        }));

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('documentId');
      expect(response.body.processingStatus).toBe('QUEUED');
    });

    it('should upload and process SACCO statement', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/credit-assessment/upload-document')
        .attach('file', path.join(testFilesDir, 'sacco-statement.txt'))
        .field('customerId', '12345')
        .field('documentType', DocumentType.SACCO_STATEMENT)
        .field('additionalData', JSON.stringify({
          saccoName: 'Test SACCO',
          membershipType: 'Regular'
        }));

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('documentId');
      expect(response.body.processingStatus).toBe('QUEUED');
    });

    it('should reject invalid document type', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/credit-assessment/upload-document')
        .attach('file', path.join(testFilesDir, 'bank-statement.txt'))
        .field('customerId', '12345')
        .field('documentType', 'INVALID_TYPE');

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Invalid document type');
    });

    it('should reject missing customer ID', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/credit-assessment/upload-document')
        .attach('file', path.join(testFilesDir, 'bank-statement.txt'))
        .field('documentType', DocumentType.BANK_STATEMENT);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('customerId');
    });

    it('should reject missing file', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/credit-assessment/upload-document')
        .field('customerId', '12345')
        .field('documentType', DocumentType.BANK_STATEMENT);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('file');
    });
  });

  describe('Document Processing Status', () => {
    let documentId: number;

    beforeAll(async () => {
      // Upload a document to get its ID
      const response = await request(app.getHttpServer())
        .post('/api/credit-assessment/upload-document')
        .attach('file', path.join(testFilesDir, 'bank-statement.txt'))
        .field('customerId', '12345')
        .field('documentType', DocumentType.BANK_STATEMENT);

      documentId = response.body.documentId;
    });

    it('should get document processing status', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/credit-assessment/document/${documentId}/status`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('progress');
      expect(response.body).toHaveProperty('lastUpdated');
    });

    it('should get document processing results when complete', async () => {
      // Wait for processing to complete (max 10 seconds)
      let status = 'QUEUED';
      let attempts = 0;
      while (status !== 'COMPLETED' && attempts < 10) {
        const response = await request(app.getHttpServer())
          .get(`/api/credit-assessment/document/${documentId}/status`);
        status = response.body.status;
        if (status !== 'COMPLETED') {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        attempts++;
      }

      const response = await request(app.getHttpServer())
        .get(`/api/credit-assessment/document/${documentId}/results`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('extractedData');
      expect(response.body).toHaveProperty('transactions');
      expect(response.body).toHaveProperty('metadata');
    });

    it('should handle non-existent document', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/credit-assessment/document/999999/status');

      expect(response.status).toBe(404);
      expect(response.body.message).toContain('not found');
    });
  });

  describe('Transaction Categorization', () => {
    it('should categorize bank transactions', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/credit-assessment/categorize')
        .send({
          transactions: [
            {
              description: 'SALARY PAYMENT FROM COMPANY XYZ',
              amount: 45000,
              date: '2023-01-05'
            },
            {
              description: 'ELECTRICITY BILL KPLC',
              amount: -2500,
              date: '2023-01-15'
            },
            {
              description: 'ATM WITHDRAWAL',
              amount: -5000,
              date: '2023-01-20'
            }
          ]
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(3);
      
      const [salary, bill, withdrawal] = response.body;
      expect(salary.category).toBe('INCOME');
      expect(salary.subcategory).toBe('SALARY');
      expect(bill.category).toBe('BILLS');
      expect(bill.subcategory).toBe('ELECTRICITY');
      expect(withdrawal.category).toBe('CASH');
      expect(withdrawal.subcategory).toBe('WITHDRAWAL');
    });

    it('should categorize M-Pesa transactions', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/credit-assessment/categorize')
        .send({
          transactions: [
            {
              description: 'Send Money to +254723456789 JANE DOE',
              amount: -1000,
              date: '2023-01-01'
            },
            {
              description: 'Pay Bill KPLC TOKEN',
              amount: -2500,
              date: '2023-01-10'
            },
            {
              description: 'Buy Goods NAIVAS SUPERMARKET',
              amount: -3500,
              date: '2023-01-20'
            }
          ]
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(3);
      
      const [transfer, bill, shopping] = response.body;
      expect(transfer.category).toBe('MOBILE_MONEY');
      expect(transfer.subcategory).toBe('SEND');
      expect(bill.category).toBe('BILLS');
      expect(bill.subcategory).toBe('ELECTRICITY');
      expect(shopping.category).toBe('SHOPPING');
      expect(shopping.subcategory).toBe('SUPERMARKET');
    });

    it('should categorize SACCO transactions', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/credit-assessment/categorize')
        .send({
          transactions: [
            {
              description: 'Monthly Contribution',
              amount: 5000,
              date: '2023-01-05'
            },
            {
              description: 'Loan Disbursement',
              amount: 50000,
              date: '2023-01-10'
            },
            {
              description: 'Share Purchase',
              amount: 5000,
              date: '2023-01-20'
            }
          ]
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(3);
      
      const [contribution, loan, shares] = response.body;
      expect(contribution.category).toBe('SAVINGS');
      expect(contribution.subcategory).toBe('SACCO');
      expect(loan.category).toBe('LOANS');
      expect(loan.subcategory).toBe('DISBURSEMENT');
      expect(shares.category).toBe('SAVINGS');
      expect(shares.subcategory).toBe('SACCO');
    });
  });

  describe('Error Handling', () => {
    it('should handle corrupted files', async () => {
      // Create a corrupted file
      const corruptedPath = path.join(testFilesDir, 'corrupted.pdf');
      fs.writeFileSync(corruptedPath, 'Not a valid PDF file');

      const response = await request(app.getHttpServer())
        .post('/api/credit-assessment/upload-document')
        .attach('file', corruptedPath)
        .field('customerId', '12345')
        .field('documentType', DocumentType.BANK_STATEMENT);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Invalid file format');

      // Clean up
      fs.unlinkSync(corruptedPath);
    });

    it('should handle large files', async () => {
      // Create a large file (11MB)
      const largePath = path.join(testFilesDir, 'large.pdf');
      fs.writeFileSync(largePath, Buffer.alloc(11 * 1024 * 1024));

      const response = await request(app.getHttpServer())
        .post('/api/credit-assessment/upload-document')
        .attach('file', largePath)
        .field('customerId', '12345')
        .field('documentType', DocumentType.BANK_STATEMENT);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('File too large');

      // Clean up
      fs.unlinkSync(largePath);
    });

    it('should handle unsupported file types', async () => {
      // Create an unsupported file
      const unsupportedPath = path.join(testFilesDir, 'test.xyz');
      fs.writeFileSync(unsupportedPath, 'Some content');

      const response = await request(app.getHttpServer())
        .post('/api/credit-assessment/upload-document')
        .attach('file', unsupportedPath)
        .field('customerId', '12345')
        .field('documentType', DocumentType.BANK_STATEMENT);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Unsupported file type');

      // Clean up
      fs.unlinkSync(unsupportedPath);
    });

    it('should handle invalid JSON in additionalData', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/credit-assessment/upload-document')
        .attach('file', path.join(testFilesDir, 'bank-statement.txt'))
        .field('customerId', '12345')
        .field('documentType', DocumentType.BANK_STATEMENT)
        .field('additionalData', 'invalid json');

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Invalid additionalData format');
    });
  });
});
