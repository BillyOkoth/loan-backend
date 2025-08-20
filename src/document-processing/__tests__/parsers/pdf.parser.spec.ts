import { Test, TestingModule } from '@nestjs/testing';
import { PdfParser } from '../../parsers/pdf.parser';
import { DocumentType } from '../../../entities/financial-documents.entity';
import * as fs from 'fs';
import * as path from 'path';

describe('PdfParser', () => {
  let parser: PdfParser;
  const testFilesDir = path.join(__dirname, '../test-files');

  beforeAll(() => {
    // Create test files directory if it doesn't exist
    if (!fs.existsSync(testFilesDir)) {
      fs.mkdirSync(testFilesDir, { recursive: true });
    }
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PdfParser],
    }).compile();

    parser = module.get<PdfParser>(PdfParser);
  });

  describe('canHandle', () => {
    it('should return true for PDF files', () => {
      expect(parser.canHandle('test.pdf', DocumentType.BANK_STATEMENT)).toBe(true);
      expect(parser.canHandle('test.PDF', DocumentType.BANK_STATEMENT)).toBe(true);
    });

    it('should return false for non-PDF files', () => {
      expect(parser.canHandle('test.csv', DocumentType.BANK_STATEMENT)).toBe(false);
      expect(parser.canHandle('test.txt', DocumentType.BANK_STATEMENT)).toBe(false);
    });
  });

  describe('parse', () => {
    let testPdfPath: string;

    beforeAll(() => {
      // Create a test PDF file
      testPdfPath = path.join(testFilesDir, 'test-bank-statement.pdf');
      // TODO: Create test PDF file with known content
    });

    afterAll(() => {
      // Clean up test files
      if (fs.existsSync(testPdfPath)) {
        fs.unlinkSync(testPdfPath);
      }
    });

    it('should successfully parse a bank statement PDF', async () => {
      const result = await parser.parse(testPdfPath, {
        documentType: DocumentType.BANK_STATEMENT,
        extractText: true,
        validateStructure: true
      });

      expect(result.success).toBe(true);
      expect(result.metadata).toBeDefined();
      expect(result.metadata.confidence).toBeGreaterThan(0);
    });

    it('should extract account information from bank statement', async () => {
      const result = await parser.parse(testPdfPath, {
        documentType: DocumentType.BANK_STATEMENT
      });

      expect(result.metadata.accountNumber).toBeDefined();
      expect(result.metadata.accountName).toBeDefined();
      expect(result.metadata.bankName).toBeDefined();
    });

    it('should extract transactions from bank statement', async () => {
      const result = await parser.parse(testPdfPath, {
        documentType: DocumentType.BANK_STATEMENT
      });

      expect(result.transactions).toBeDefined();
      expect(Array.isArray(result.transactions)).toBe(true);
      expect(result.transactions.length).toBeGreaterThan(0);

      const transaction = result.transactions[0];
      expect(transaction.transaction_date).toBeDefined();
      expect(transaction.description).toBeDefined();
      expect(transaction.amount).toBeDefined();
      expect(transaction.balance_after).toBeDefined();
    });

    it('should handle corrupted PDF files', async () => {
      const corruptedPdfPath = path.join(testFilesDir, 'corrupted.pdf');
      fs.writeFileSync(corruptedPdfPath, 'Not a PDF file');

      try {
        await parser.parse(corruptedPdfPath, {
          documentType: DocumentType.BANK_STATEMENT
        });
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).toContain('PDF');
      } finally {
        fs.unlinkSync(corruptedPdfPath);
      }
    });

    it('should handle missing files', async () => {
      const nonExistentPath = path.join(testFilesDir, 'non-existent.pdf');

      try {
        await parser.parse(nonExistentPath, {
          documentType: DocumentType.BANK_STATEMENT
        });
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).toContain('not found');
      }
    });
  });

  describe('validateDocument', () => {
    let validPdfPath: string;
    let invalidPdfPath: string;

    beforeAll(() => {
      // Create test files
      validPdfPath = path.join(testFilesDir, 'valid.pdf');
      invalidPdfPath = path.join(testFilesDir, 'invalid.pdf');
      // TODO: Create test PDF files
    });

    afterAll(() => {
      // Clean up test files
      [validPdfPath, invalidPdfPath].forEach(file => {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      });
    });

    it('should validate a valid PDF file', async () => {
      const isValid = await parser.validateDocument(validPdfPath);
      expect(isValid).toBe(true);
    });

    it('should reject an invalid PDF file', async () => {
      const isValid = await parser.validateDocument(invalidPdfPath);
      expect(isValid).toBe(false);
    });
  });

  describe('extractMetadata', () => {
    let testPdfPath: string;

    beforeAll(() => {
      // Create test file
      testPdfPath = path.join(testFilesDir, 'metadata-test.pdf');
      // TODO: Create test PDF file with known metadata
    });

    afterAll(() => {
      // Clean up test files
      if (fs.existsSync(testPdfPath)) {
        fs.unlinkSync(testPdfPath);
      }
    });

    it('should extract PDF metadata', async () => {
      const metadata = await parser.extractMetadata(testPdfPath);

      expect(metadata).toBeDefined();
      expect(metadata.pageCount).toBeDefined();
      expect(metadata.info).toBeDefined();
      expect(metadata.version).toBeDefined();
    });
  });
});
