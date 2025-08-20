import { Injectable, Logger } from '@nestjs/common';
import { DocumentType } from '../../entities/financial-documents.entity';
import * as sharp from 'sharp';
import { createWorker } from 'tesseract.js';
import { Vision } from '@google-cloud/vision';
import * as moment from 'moment-timezone';

export interface ExtractedData {
  text: string;
  metadata: {
    confidence: number;
    method: string;
    processingTime: number;
    pageCount?: number;
    resolution?: {
      width: number;
      height: number;
    };
    format?: string;
    language?: string;
  };
  structuredData?: {
    tables?: any[];
    forms?: any[];
    keyValuePairs?: Record<string, string>;
  };
  entities?: {
    type: string;
    text: string;
    confidence: number;
    metadata?: any;
  }[];
}

export interface ExtractionOptions {
  method?: 'ocr' | 'pdf' | 'vision-api' | 'auto';
  language?: string;
  enhanceImage?: boolean;
  detectTables?: boolean;
  detectForms?: boolean;
  extractEntities?: boolean;
  confidenceThreshold?: number;
  timeout?: number;
}

@Injectable()
export class DataExtractionService {
  private readonly logger = new Logger(DataExtractionService.name);
  private readonly ocrWorker: Promise<Tesseract.Worker>;
  private readonly visionClient: Vision;

  constructor() {
    // Initialize OCR worker
    this.ocrWorker = createWorker('eng+swa'); // English + Swahili

    // Initialize Google Cloud Vision client
    this.visionClient = new Vision({
      keyFilename: process.env.GOOGLE_CLOUD_CREDENTIALS
    });
  }

  async onModuleDestroy() {
    const worker = await this.ocrWorker;
    await worker.terminate();
  }

  /**
   * Extract data from a document
   */
  async extractData(
    filePath: string,
    documentType: DocumentType,
    options: ExtractionOptions = {}
  ): Promise<ExtractedData> {
    const startTime = Date.now();

    try {
      // Determine extraction method
      const method = this.determineExtractionMethod(filePath, documentType, options);
      
      let extractedData: ExtractedData;
      switch (method) {
        case 'ocr':
          extractedData = await this.extractWithOCR(filePath, options);
          break;
        case 'vision-api':
          extractedData = await this.extractWithVisionAPI(filePath, options);
          break;
        case 'pdf':
          extractedData = await this.extractFromPDF(filePath, options);
          break;
        default:
          throw new Error(`Unsupported extraction method: ${method}`);
      }

      // Post-process extracted data
      extractedData = await this.postProcessExtractedData(extractedData, documentType, options);

      // Add processing metadata
      extractedData.metadata.processingTime = Date.now() - startTime;

      return extractedData;
    } catch (error) {
      this.logger.error(`Data extraction failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Extract data from multiple documents
   */
  async extractBatch(
    files: { path: string; type: DocumentType }[],
    options: ExtractionOptions = {}
  ): Promise<Record<string, ExtractedData>> {
    const results: Record<string, ExtractedData> = {};

    await Promise.all(
      files.map(async file => {
        try {
          results[file.path] = await this.extractData(file.path, file.type, options);
        } catch (error) {
          this.logger.error(`Failed to extract data from ${file.path}: ${error.message}`);
          results[file.path] = {
            text: '',
            metadata: {
              confidence: 0,
              method: 'failed',
              processingTime: 0,
              error: error.message
            }
          };
        }
      })
    );

    return results;
  }

  /**
   * Determine the best extraction method based on file type and content
   */
  private determineExtractionMethod(
    filePath: string,
    documentType: DocumentType,
    options: ExtractionOptions
  ): string {
    if (options.method && options.method !== 'auto') {
      return options.method;
    }

    const extension = filePath.toLowerCase().split('.').pop();

    // Use Vision API for images
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(extension)) {
      return 'vision-api';
    }

    // Use PDF extraction for PDFs
    if (extension === 'pdf') {
      return 'pdf';
    }

    // Default to OCR
    return 'ocr';
  }

  /**
   * Extract data using Tesseract OCR
   */
  private async extractWithOCR(
    filePath: string,
    options: ExtractionOptions
  ): Promise<ExtractedData> {
    const worker = await this.ocrWorker;

    // Enhance image if requested
    let imageBuffer = await this.readAndProcessImage(filePath, options);

    // Perform OCR
    const { data } = await worker.recognize(imageBuffer);

    return {
      text: data.text,
      metadata: {
        confidence: data.confidence / 100,
        method: 'ocr',
        processingTime: 0,
        language: options.language || 'eng'
      },
      entities: this.extractEntitiesFromOCR(data)
    };
  }

  /**
   * Extract data using Google Cloud Vision API
   */
  private async extractWithVisionAPI(
    filePath: string,
    options: ExtractionOptions
  ): Promise<ExtractedData> {
    const requests = [{
      image: { source: { filename: filePath } },
      features: [
        { type: 'DOCUMENT_TEXT_DETECTION' },
        ...(options.detectTables ? [{ type: 'DOCUMENT_TEXT_DETECTION' }] : []),
        ...(options.extractEntities ? [{ type: 'ENTITY_DETECTION' }] : [])
      ]
    }];

    const [result] = await this.visionClient.batchAnnotateImages({ requests });
    const response = result.responses[0];

    const extractedData: ExtractedData = {
      text: response.fullTextAnnotation?.text || '',
      metadata: {
        confidence: this.calculateVisionConfidence(response),
        method: 'vision-api',
        processingTime: 0
      }
    };

    if (options.detectTables && response.fullTextAnnotation?.pages) {
      extractedData.structuredData = {
        tables: this.extractTablesFromVisionResponse(response)
      };
    }

    if (options.extractEntities && response.entityAnnotations) {
      extractedData.entities = response.entityAnnotations.map(entity => ({
        type: entity.type,
        text: entity.description,
        confidence: entity.score,
        metadata: entity.metadata
      }));
    }

    return extractedData;
  }

  /**
   * Extract data from PDF documents
   */
  private async extractFromPDF(
    filePath: string,
    options: ExtractionOptions
  ): Promise<ExtractedData> {
    // Implementation depends on the PDF processing library
    // This is a placeholder
    return {
      text: '',
      metadata: {
        confidence: 0,
        method: 'pdf',
        processingTime: 0
      }
    };
  }

  /**
   * Post-process extracted data based on document type
   */
  private async postProcessExtractedData(
    data: ExtractedData,
    documentType: DocumentType,
    options: ExtractionOptions
  ): Promise<ExtractedData> {
    // Apply document type specific processing
    switch (documentType) {
      case DocumentType.BANK_STATEMENT:
        data = await this.processBankStatement(data, options);
        break;
      case DocumentType.MPESA_STATEMENT:
        data = await this.processMpesaStatement(data, options);
        break;
      case DocumentType.SACCO_STATEMENT:
        data = await this.processSaccoStatement(data, options);
        break;
    }

    // Apply general post-processing
    data.text = this.cleanExtractedText(data.text);

    // Filter out low confidence entities
    if (data.entities && options.confidenceThreshold) {
      data.entities = data.entities.filter(e => 
        e.confidence >= options.confidenceThreshold
      );
    }

    return data;
  }

  /**
   * Process bank statement specific data
   */
  private async processBankStatement(
    data: ExtractedData,
    options: ExtractionOptions
  ): Promise<ExtractedData> {
    // Extract key-value pairs
    const keyValuePairs = this.extractKeyValuePairs(data.text, [
      { key: 'Account Number', patterns: [/Account\s*(?:No|Number)[.:]\s*(\d+)/i] },
      { key: 'Account Name', patterns: [/Account\s*Name[.:]\s*([A-Za-z\s]+)/i] },
      { key: 'Statement Period', patterns: [/Statement\s*Period[.:]\s*([\w\s\d,-]+)/i] },
      { key: 'Opening Balance', patterns: [/Opening\s*Balance[.:]\s*(?:KES|Ksh)?\s*([\d,]+\.?\d*)/i] },
      { key: 'Closing Balance', patterns: [/Closing\s*Balance[.:]\s*(?:KES|Ksh)?\s*([\d,]+\.?\d*)/i] }
    ]);

    if (Object.keys(keyValuePairs).length > 0) {
      data.structuredData = {
        ...data.structuredData,
        keyValuePairs
      };
    }

    return data;
  }

  /**
   * Process M-Pesa statement specific data
   */
  private async processMpesaStatement(
    data: ExtractedData,
    options: ExtractionOptions
  ): Promise<ExtractedData> {
    // Extract key-value pairs
    const keyValuePairs = this.extractKeyValuePairs(data.text, [
      { key: 'Phone Number', patterns: [/(?:\+254|0)?7\d{8}/] },
      { key: 'Statement Period', patterns: [/Statement\s*Period[.:]\s*([\w\s\d,-]+)/i] },
      { key: 'Account Holder', patterns: [/(?:Name|Account Holder)[.:]\s*([A-Z\s]+)/i] }
    ]);

    if (Object.keys(keyValuePairs).length > 0) {
      data.structuredData = {
        ...data.structuredData,
        keyValuePairs
      };
    }

    return data;
  }

  /**
   * Process SACCO statement specific data
   */
  private async processSaccoStatement(
    data: ExtractedData,
    options: ExtractionOptions
  ): Promise<ExtractedData> {
    // Extract key-value pairs
    const keyValuePairs = this.extractKeyValuePairs(data.text, [
      { key: 'Member Number', patterns: [/Member\s*(?:No|Number)[.:]\s*([A-Z0-9-]+)/i] },
      { key: 'Member Name', patterns: [/Member\s*Name[.:]\s*([A-Z\s]+)/i] },
      { key: 'Join Date', patterns: [/Join(?:ed)?\s*Date[.:]\s*(\d{1,2}[-/.]\d{1,2}[-/.]\d{4})/i] },
      { key: 'Total Shares', patterns: [/Total\s*Shares[.:]\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i] }
    ]);

    if (Object.keys(keyValuePairs).length > 0) {
      data.structuredData = {
        ...data.structuredData,
        keyValuePairs
      };
    }

    return data;
  }

  /**
   * Extract entities from OCR results
   */
  private extractEntitiesFromOCR(ocrData: any): any[] {
    const entities = [];

    // Extract dates
    const datePatterns = [
      /\d{1,2}[-/.]\d{1,2}[-/.]\d{4}/,
      /\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/
    ];

    for (const pattern of datePatterns) {
      const matches = ocrData.text.match(new RegExp(pattern, 'g')) || [];
      for (const match of matches) {
        entities.push({
          type: 'DATE',
          text: match,
          confidence: ocrData.confidence / 100
        });
      }
    }

    // Extract amounts
    const amountPattern = /(?:KES|Ksh)?\s*\d+(?:,\d{3})*(?:\.\d{2})?/g;
    const amounts = ocrData.text.match(amountPattern) || [];
    for (const amount of amounts) {
      entities.push({
        type: 'AMOUNT',
        text: amount,
        confidence: ocrData.confidence / 100
      });
    }

    // Extract phone numbers
    const phonePattern = /(?:\+254|0)?7\d{8}/g;
    const phones = ocrData.text.match(phonePattern) || [];
    for (const phone of phones) {
      entities.push({
        type: 'PHONE_NUMBER',
        text: phone,
        confidence: ocrData.confidence / 100
      });
    }

    return entities;
  }

  /**
   * Extract tables from Vision API response
   */
  private extractTablesFromVisionResponse(response: any): any[] {
    const tables = [];
    
    if (!response.fullTextAnnotation?.pages) {
      return tables;
    }

    for (const page of response.fullTextAnnotation.pages) {
      if (!page.tables) continue;

      for (const table of page.tables) {
        const extractedTable = {
          rows: table.rows.length,
          columns: table.columns.length,
          cells: []
        };

        for (const cell of table.cells) {
          extractedTable.cells.push({
            text: cell.text,
            rowIndex: cell.rowIndex,
            columnIndex: cell.columnIndex,
            rowSpan: cell.rowSpan,
            columnSpan: cell.columnSpan
          });
        }

        tables.push(extractedTable);
      }
    }

    return tables;
  }

  /**
   * Calculate confidence score from Vision API response
   */
  private calculateVisionConfidence(response: any): number {
    if (!response.textAnnotations || response.textAnnotations.length === 0) {
      return 0;
    }

    // Average confidence across all detected text blocks
    const confidences = response.textAnnotations.map(annotation => annotation.confidence);
    return confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;
  }

  /**
   * Clean and normalize extracted text
   */
  private cleanExtractedText(text: string): string {
    return text
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[^\x20-\x7E\n]/g, '') // Remove non-printable characters
      .trim();
  }

  /**
   * Extract key-value pairs from text
   */
  private extractKeyValuePairs(
    text: string,
    patterns: { key: string; patterns: RegExp[] }[]
  ): Record<string, string> {
    const results: Record<string, string> = {};

    for (const { key, patterns: keyPatterns } of patterns) {
      for (const pattern of keyPatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          results[key] = match[1].trim();
          break;
        }
      }
    }

    return results;
  }

  /**
   * Read and process image for better OCR results
   */
  private async readAndProcessImage(
    filePath: string,
    options: ExtractionOptions
  ): Promise<Buffer> {
    if (!options.enhanceImage) {
      return fs.readFileSync(filePath);
    }

    const image = sharp(filePath);

    // Apply image enhancements
    image
      .normalize() // Normalize contrast
      .sharpen() // Sharpen edges
      .threshold(128) // Convert to black and white
      .linear(1.5, -0.2); // Adjust brightness and contrast

    return await image.toBuffer();
  }
}
