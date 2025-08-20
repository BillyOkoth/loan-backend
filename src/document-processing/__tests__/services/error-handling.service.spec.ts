import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorHandlingService } from '../../services/error-handling.service';
import { DocumentType } from '../../../entities/financial-documents.entity';
import * as fs from 'fs';
import * as path from 'path';

describe('ErrorHandlingService', () => {
  let service: ErrorHandlingService;
  const testFilesDir = path.join(__dirname, '../test-files');

  beforeAll(() => {
    if (!fs.existsSync(testFilesDir)) {
      fs.mkdirSync(testFilesDir, { recursive: true });
    }
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ErrorHandlingService],
    }).compile();

    service = module.get<ErrorHandlingService>(ErrorHandlingService);
  });

  describe('validateDocument', () => {
    let validPdfPath: string;
    let largePdfPath: string;
    let invalidFilePath: string;

    beforeAll(() => {
      validPdfPath = path.join(testFilesDir, 'valid.pdf');
      largePdfPath = path.join(testFilesDir, 'large.pdf');
      invalidFilePath = path.join(testFilesDir, 'invalid.txt');

      // Create test files
      fs.writeFileSync(validPdfPath, 'PDF content');
      fs.writeFileSync(largePdfPath, Buffer.alloc(11 * 1024 * 1024)); // 11MB file
      fs.writeFileSync(invalidFilePath, 'Invalid content');
    });

    afterAll(() => {
      // Clean up test files
      [validPdfPath, largePdfPath, invalidFilePath].forEach(file => {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      });
    });

    it('should validate a valid document', async () => {
      const result = await service.validateDocument(
        validPdfPath,
        DocumentType.BANK_STATEMENT
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject files that are too large', async () => {
      const result = await service.validateDocument(
        largePdfPath,
        DocumentType.BANK_STATEMENT
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('FILE_TOO_LARGE');
    });

    it('should reject invalid file types', async () => {
      const result = await service.validateDocument(
        invalidFilePath,
        DocumentType.BANK_STATEMENT
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('INVALID_FILE_TYPE');
    });

    it('should handle non-existent files', async () => {
      const result = await service.validateDocument(
        'non-existent.pdf',
        DocumentType.BANK_STATEMENT
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('FILE_NOT_FOUND');
    });
  });

  describe('validateExtractedData', () => {
    const validBankData = {
      account_number: '1234567890',
      statement_period: {
        start: new Date('2023-01-01'),
        end: new Date('2023-01-31')
      },
      transactions: [
        {
          date: new Date(),
          description: 'Test transaction',
          amount: 1000
        }
      ]
    };

    it('should validate complete bank statement data', () => {
      const result = service.validateExtractedData(
        validBankData,
        DocumentType.BANK_STATEMENT
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing required fields', () => {
      const incompleteData = {
        account_number: '1234567890',
        // Missing statement_period
        transactions: []
      };

      const result = service.validateExtractedData(
        incompleteData,
        DocumentType.BANK_STATEMENT
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('MISSING_REQUIRED_FIELD');
    });

    it('should validate transaction data', () => {
      const dataWithInvalidTransaction = {
        ...validBankData,
        transactions: [
          {
            // Missing date
            description: 'Test',
            amount: 1000
          }
        ]
      };

      const result = service.validateExtractedData(
        dataWithInvalidTransaction,
        DocumentType.BANK_STATEMENT
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'MISSING_TRANSACTION_FIELD')).toBe(true);
    });

    it('should validate M-Pesa statement data', () => {
      const mpesaData = {
        phone_number: '+254712345678',
        statement_period: {
          start: new Date(),
          end: new Date()
        },
        transactions: [
          {
            date: new Date(),
            description: 'Send money to John',
            amount: 1000,
            type: 'send'
          }
        ]
      };

      const result = service.validateExtractedData(
        mpesaData,
        DocumentType.MPESA_STATEMENT
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate SACCO statement data', () => {
      const saccoData = {
        member_number: 'SACCO123',
        statement_period: {
          start: new Date(),
          end: new Date()
        },
        transactions: [
          {
            date: new Date(),
            description: 'Share contribution',
            amount: 5000,
            type: 'CONTRIBUTION'
          }
        ],
        total_shares: 50000
      };

      const result = service.validateExtractedData(
        saccoData,
        DocumentType.SACCO_STATEMENT
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('handleProcessingError', () => {
    it('should handle file not found errors', () => {
      const error = new Error('ENOENT: no such file or directory');
      const context = {
        documentId: 1,
        documentType: DocumentType.BANK_STATEMENT,
        filePath: 'missing.pdf',
        stage: 'PROCESSING'
      };

      const httpError = service.handleProcessingError(error, context);

      expect(httpError).toBeInstanceOf(HttpException);
      expect(httpError.getStatus()).toBe(HttpStatus.NOT_FOUND);
      
      const response = httpError.getResponse() as any;
      expect(response.code).toBe('FILE_NOT_FOUND');
    });

    it('should handle validation errors', () => {
      const error = new Error('Validation failed');
      error.name = 'ValidationError';
      const context = {
        documentId: 1,
        documentType: DocumentType.BANK_STATEMENT,
        stage: 'VALIDATION'
      };

      const httpError = service.handleProcessingError(error, context);

      expect(httpError).toBeInstanceOf(HttpException);
      expect(httpError.getStatus()).toBe(HttpStatus.BAD_REQUEST);
      
      const response = httpError.getResponse() as any;
      expect(response.code).toBe('VALIDATION_ERROR');
    });

    it('should handle permission errors', () => {
      const error = new Error('Permission denied');
      const context = {
        documentId: 1,
        documentType: DocumentType.BANK_STATEMENT,
        stage: 'PROCESSING'
      };

      const httpError = service.handleProcessingError(error, context);

      expect(httpError).toBeInstanceOf(HttpException);
      expect(httpError.getStatus()).toBe(HttpStatus.FORBIDDEN);
      
      const response = httpError.getResponse() as any;
      expect(response.code).toBe('PERMISSION_DENIED');
    });

    it('should handle generic processing errors', () => {
      const error = new Error('Unknown error');
      const context = {
        documentId: 1,
        documentType: DocumentType.BANK_STATEMENT,
        stage: 'PROCESSING'
      };

      const httpError = service.handleProcessingError(error, context);

      expect(httpError).toBeInstanceOf(HttpException);
      expect(httpError.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      
      const response = httpError.getResponse() as any;
      expect(response.code).toBe('PROCESSING_ERROR');
    });
  });

  describe('Error Logging', () => {
    it('should log and retrieve errors', () => {
      const error = new Error('Test error');
      const context = {
        documentId: 1,
        documentType: DocumentType.BANK_STATEMENT,
        stage: 'PROCESSING'
      };

      service.handleProcessingError(error, context);

      const recentErrors = service.getRecentErrors(1);
      expect(recentErrors).toHaveLength(1);
      expect(recentErrors[0].message).toBe('Test error');
    });

    it('should maintain maximum log size', () => {
      // Generate more errors than the maximum log size
      for (let i = 0; i < 1100; i++) {
        const error = new Error(`Error ${i}`);
        service.handleProcessingError(error, { stage: 'TEST' });
      }

      const allErrors = service.getRecentErrors(2000);
      expect(allErrors.length).toBeLessThanOrEqual(1000); // Max log size
    });

    it('should clear error log', () => {
      const error = new Error('Test error');
      service.handleProcessingError(error, { stage: 'TEST' });
      
      service.clearErrorLog();
      
      const recentErrors = service.getRecentErrors();
      expect(recentErrors).toHaveLength(0);
    });
  });

  describe('Metadata Validation', () => {
    it('should validate bank statement metadata', () => {
      const metadata = {
        processingTime: 5000,
        confidence: 0.9,
        bankName: 'Test Bank'
      };

      const result = service.validateExtractedData(
        { metadata },
        DocumentType.BANK_STATEMENT
      );

      expect(result.warnings).toHaveLength(0);
    });

    it('should warn about high processing time', () => {
      const metadata = {
        processingTime: 35000, // 35 seconds
        confidence: 0.9
      };

      const result = service.validateExtractedData(
        { metadata },
        DocumentType.BANK_STATEMENT
      );

      expect(result.warnings.some(w => w.code === 'HIGH_PROCESSING_TIME')).toBe(true);
    });

    it('should warn about low confidence', () => {
      const metadata = {
        processingTime: 5000,
        confidence: 0.5
      };

      const result = service.validateExtractedData(
        { metadata },
        DocumentType.BANK_STATEMENT
      );

      expect(result.warnings.some(w => w.code === 'LOW_CONFIDENCE')).toBe(true);
    });
  });
});
