import { Test, TestingModule } from '@nestjs/testing';
import { DataExtractionService } from '../../services/data-extraction.service';
import { DocumentType } from '../../../entities/financial-documents.entity';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('@google-cloud/vision', () => ({
  Vision: jest.fn().mockImplementation(() => ({
    batchAnnotateImages: jest.fn().mockResolvedValue([{
      responses: [{
        fullTextAnnotation: {
          text: 'Sample text',
          pages: []
        },
        textAnnotations: [
          { confidence: 0.9 }
        ]
      }]
    }])
  }))
}));

describe('DataExtractionService', () => {
  let service: DataExtractionService;
  const testFilesDir = path.join(__dirname, '../test-files');

  beforeAll(() => {
    if (!fs.existsSync(testFilesDir)) {
      fs.mkdirSync(testFilesDir, { recursive: true });
    }
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DataExtractionService],
    }).compile();

    service = module.get<DataExtractionService>(DataExtractionService);
  });

  describe('extractData', () => {
    let testPdfPath: string;
    let testImagePath: string;

    beforeAll(() => {
      testPdfPath = path.join(testFilesDir, 'test.pdf');
      testImagePath = path.join(testFilesDir, 'test.jpg');

      // Create test files
      fs.writeFileSync(testPdfPath, 'PDF content');
      fs.writeFileSync(testImagePath, 'Image content');
    });

    afterAll(() => {
      // Clean up test files
      [testPdfPath, testImagePath].forEach(file => {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      });
    });

    it('should extract data from PDF file', async () => {
      const result = await service.extractData(
        testPdfPath,
        DocumentType.BANK_STATEMENT,
        { method: 'pdf' }
      );

      expect(result.text).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.metadata.method).toBe('pdf');
    });

    it('should extract data from image file', async () => {
      const result = await service.extractData(
        testImagePath,
        DocumentType.BANK_STATEMENT,
        { method: 'vision-api' }
      );

      expect(result.text).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.metadata.method).toBe('vision-api');
    });

    it('should handle OCR extraction', async () => {
      const result = await service.extractData(
        testImagePath,
        DocumentType.BANK_STATEMENT,
        { method: 'ocr' }
      );

      expect(result.text).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.metadata.method).toBe('ocr');
    });

    it('should automatically determine best extraction method', async () => {
      const result = await service.extractData(
        testPdfPath,
        DocumentType.BANK_STATEMENT,
        { method: 'auto' }
      );

      expect(result.metadata.method).toBeDefined();
    });

    it('should extract tables when requested', async () => {
      const result = await service.extractData(
        testPdfPath,
        DocumentType.BANK_STATEMENT,
        { detectTables: true }
      );

      expect(result.structuredData).toBeDefined();
      expect(result.structuredData.tables).toBeDefined();
    });

    it('should extract entities when requested', async () => {
      const result = await service.extractData(
        testPdfPath,
        DocumentType.BANK_STATEMENT,
        { extractEntities: true }
      );

      expect(result.entities).toBeDefined();
    });

    it('should handle extraction errors', async () => {
      await expect(
        service.extractData(
          'non-existent.pdf',
          DocumentType.BANK_STATEMENT
        )
      ).rejects.toThrow();
    });
  });

  describe('extractBatch', () => {
    const testFiles = [
      { path: path.join(testFilesDir, 'test1.pdf'), type: DocumentType.BANK_STATEMENT },
      { path: path.join(testFilesDir, 'test2.pdf'), type: DocumentType.MPESA_STATEMENT }
    ];

    beforeAll(() => {
      // Create test files
      testFiles.forEach(file => {
        fs.writeFileSync(file.path, 'Test content');
      });
    });

    afterAll(() => {
      // Clean up test files
      testFiles.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
    });

    it('should process multiple files', async () => {
      const results = await service.extractBatch(testFiles);

      expect(Object.keys(results)).toHaveLength(testFiles.length);
      testFiles.forEach(file => {
        expect(results[file.path]).toBeDefined();
        expect(results[file.path].metadata).toBeDefined();
      });
    });

    it('should handle failures in batch processing', async () => {
      const filesWithError = [
        ...testFiles,
        { path: 'non-existent.pdf', type: DocumentType.BANK_STATEMENT }
      ];

      const results = await service.extractBatch(filesWithError);

      expect(results['non-existent.pdf'].metadata.error).toBeDefined();
      expect(results['non-existent.pdf'].text).toBe('');
    });
  });

  describe('Document Type Specific Processing', () => {
    let bankStatementPath: string;
    let mpesaStatementPath: string;
    let saccoStatementPath: string;

    beforeAll(() => {
      bankStatementPath = path.join(testFilesDir, 'bank.pdf');
      mpesaStatementPath = path.join(testFilesDir, 'mpesa.pdf');
      saccoStatementPath = path.join(testFilesDir, 'sacco.pdf');

      // Create test files with specific content
      fs.writeFileSync(bankStatementPath, 'Bank statement content');
      fs.writeFileSync(mpesaStatementPath, 'M-Pesa statement content');
      fs.writeFileSync(saccoStatementPath, 'SACCO statement content');
    });

    afterAll(() => {
      // Clean up test files
      [bankStatementPath, mpesaStatementPath, saccoStatementPath].forEach(file => {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      });
    });

    it('should process bank statements', async () => {
      const result = await service.extractData(
        bankStatementPath,
        DocumentType.BANK_STATEMENT
      );

      expect(result.structuredData?.keyValuePairs).toBeDefined();
      expect(result.metadata.confidence).toBeGreaterThan(0);
    });

    it('should process M-Pesa statements', async () => {
      const result = await service.extractData(
        mpesaStatementPath,
        DocumentType.MPESA_STATEMENT
      );

      expect(result.structuredData?.keyValuePairs).toBeDefined();
      expect(result.metadata.confidence).toBeGreaterThan(0);
    });

    it('should process SACCO statements', async () => {
      const result = await service.extractData(
        saccoStatementPath,
        DocumentType.SACCO_STATEMENT
      );

      expect(result.structuredData?.keyValuePairs).toBeDefined();
      expect(result.metadata.confidence).toBeGreaterThan(0);
    });
  });

  describe('Image Processing', () => {
    let testImagePath: string;

    beforeAll(() => {
      testImagePath = path.join(testFilesDir, 'test.jpg');
      fs.writeFileSync(testImagePath, 'Image content');
    });

    afterAll(() => {
      if (fs.existsSync(testImagePath)) {
        fs.unlinkSync(testImagePath);
      }
    });

    it('should enhance image when requested', async () => {
      const result = await service.extractData(
        testImagePath,
        DocumentType.BANK_STATEMENT,
        { enhanceImage: true }
      );

      expect(result.metadata.confidence).toBeGreaterThan(0);
    });

    it('should handle different image formats', async () => {
      const imageFormats = ['jpg', 'png', 'bmp'];

      for (const format of imageFormats) {
        const imagePath = path.join(testFilesDir, `test.${format}`);
        fs.writeFileSync(imagePath, 'Image content');

        const result = await service.extractData(
          imagePath,
          DocumentType.BANK_STATEMENT
        );

        expect(result.text).toBeDefined();
        fs.unlinkSync(imagePath);
      }
    });
  });

  describe('Key-Value Extraction', () => {
    it('should extract key-value pairs from bank statements', async () => {
      const testContent = `
        Account Number: 1234567890
        Account Name: John Doe
        Statement Period: Jan 2023 - Feb 2023
        Opening Balance: KES 50,000.00
        Closing Balance: KES 75,000.00
      `;

      const testPath = path.join(testFilesDir, 'bank_kv.txt');
      fs.writeFileSync(testPath, testContent);

      const result = await service.extractData(
        testPath,
        DocumentType.BANK_STATEMENT
      );

      expect(result.structuredData?.keyValuePairs).toEqual(expect.objectContaining({
        'Account Number': '1234567890',
        'Account Name': 'John Doe',
        'Statement Period': 'Jan 2023 - Feb 2023'
      }));

      fs.unlinkSync(testPath);
    });

    it('should extract key-value pairs from M-Pesa statements', async () => {
      const testContent = `
        Phone Number: +254712345678
        Statement Period: 01/01/2023 - 31/01/2023
        Account Holder: JOHN DOE
      `;

      const testPath = path.join(testFilesDir, 'mpesa_kv.txt');
      fs.writeFileSync(testPath, testContent);

      const result = await service.extractData(
        testPath,
        DocumentType.MPESA_STATEMENT
      );

      expect(result.structuredData?.keyValuePairs).toEqual(expect.objectContaining({
        'Phone Number': '+254712345678',
        'Statement Period': '01/01/2023 - 31/01/2023',
        'Account Holder': 'JOHN DOE'
      }));

      fs.unlinkSync(testPath);
    });
  });

  describe('Entity Extraction', () => {
    it('should extract dates', async () => {
      const testContent = `
        Transaction Date: 01/01/2023
        Value Date: 2023-01-02
        Processing Date: 03-01-2023
      `;

      const testPath = path.join(testFilesDir, 'dates.txt');
      fs.writeFileSync(testPath, testContent);

      const result = await service.extractData(
        testPath,
        DocumentType.BANK_STATEMENT,
        { extractEntities: true }
      );

      expect(result.entities).toBeDefined();
      expect(result.entities.filter(e => e.type === 'DATE')).toHaveLength(3);

      fs.unlinkSync(testPath);
    });

    it('should extract amounts', async () => {
      const testContent = `
        Amount: KES 50,000.00
        Balance: Ksh 75,000.50
        Fee: 1,000.00
      `;

      const testPath = path.join(testFilesDir, 'amounts.txt');
      fs.writeFileSync(testPath, testContent);

      const result = await service.extractData(
        testPath,
        DocumentType.BANK_STATEMENT,
        { extractEntities: true }
      );

      expect(result.entities).toBeDefined();
      expect(result.entities.filter(e => e.type === 'AMOUNT')).toHaveLength(3);

      fs.unlinkSync(testPath);
    });

    it('should extract phone numbers', async () => {
      const testContent = `
        Contact: +254712345678
        Alternative: 0712345678
        Support: 254712345678
      `;

      const testPath = path.join(testFilesDir, 'phones.txt');
      fs.writeFileSync(testPath, testContent);

      const result = await service.extractData(
        testPath,
        DocumentType.MPESA_STATEMENT,
        { extractEntities: true }
      );

      expect(result.entities).toBeDefined();
      expect(result.entities.filter(e => e.type === 'PHONE_NUMBER')).toHaveLength(3);

      fs.unlinkSync(testPath);
    });
  });
});
