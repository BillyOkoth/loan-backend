import { Injectable, Logger } from '@nestjs/common';
import { DocumentType } from '../../entities/financial-documents.entity';
import { DocumentParser, DocumentParserResult, DocumentParserOptions } from '../interfaces/parser.interface';
import * as pdfParse from 'pdf-parse';
import * as fs from 'fs';
import * as path from 'path';
import { createWorker } from 'tesseract.js';
import * as sharp from 'sharp';
import * as moment from 'moment-timezone';

@Injectable()
export class PdfParser implements DocumentParser {
  private readonly logger = new Logger(PdfParser.name);
  private readonly supportedTypes = ['.pdf'];
  private readonly ocrWorker: Promise<Tesseract.Worker>;

  constructor() {
    // Initialize OCR worker
    this.ocrWorker = createWorker('eng');
  }

  async onModuleDestroy() {
    const worker = await this.ocrWorker;
    await worker.terminate();
  }

  canHandle(fileType: string, documentType: DocumentType): boolean {
    return this.supportedTypes.includes(path.extname(fileType).toLowerCase());
  }

  async parse(filePath: string, options: DocumentParserOptions): Promise<DocumentParserResult> {
    try {
      this.logger.debug(`Starting PDF parsing for file: ${filePath}`);
      const startTime = Date.now();

      // Read and parse PDF
      const dataBuffer = fs.readFileSync(filePath);
      const { text, metadata } = await this.extractTextAndMetadata(dataBuffer, options);

      // If text extraction failed and OCR is enabled, try OCR
      let finalText = text;
      if (!text && options.ocrEnabled) {
        finalText = await this.performOCR(filePath);
      }

      if (!finalText) {
        throw new Error('No text could be extracted from the document');
      }

      // Process based on document type
      let result: DocumentParserResult;
      switch (options.documentType) {
        case DocumentType.BANK_STATEMENT:
          result = await this.parseBankStatement(finalText, options);
          break;
        case DocumentType.MPESA_STATEMENT:
          result = await this.parseMpesaStatement(finalText, options);
          break;
        case DocumentType.SACCO_STATEMENT:
          result = await this.parseSaccoStatement(finalText, options);
          break;
        default:
          result = await this.parseGenericDocument(finalText, options);
      }

      // Add processing metadata
      result.metadata = {
        ...result.metadata,
        ...metadata,
        processingTime: Date.now() - startTime,
        extractedText: options.extractText ? finalText : undefined,
      };

      return result;
    } catch (error) {
      this.logger.error(`PDF parsing failed: ${error.message}`, error.stack);
      return {
        success: false,
        error: {
          code: 'PDF_PARSE_ERROR',
          message: error.message,
          details: error.stack
        }
      };
    }
  }

  async validateDocument(filePath: string): Promise<boolean> {
    try {
      const dataBuffer = fs.readFileSync(filePath);
      await pdfParse(dataBuffer, { max: 1 }); // Just validate first page
      return true;
    } catch (error) {
      this.logger.error(`PDF validation failed: ${error.message}`);
      return false;
    }
  }

  async extractMetadata(filePath: string): Promise<Record<string, any>> {
    try {
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse(dataBuffer, { max: 1 });
      return {
        pageCount: data.numpages,
        info: data.info,
        metadata: data.metadata,
        version: data.version
      };
    } catch (error) {
      this.logger.error(`Metadata extraction failed: ${error.message}`);
      return {};
    }
  }

  private async extractTextAndMetadata(dataBuffer: Buffer, options: DocumentParserOptions): Promise<{ text: string; metadata: any }> {
    const data = await pdfParse(dataBuffer, {
      max: options.maxPages,
      timeout: options.timeout,
    });

    return {
      text: data.text,
      metadata: {
        pageCount: data.numpages,
        info: data.info,
        version: data.version
      }
    };
  }

  private async performOCR(filePath: string): Promise<string> {
    try {
      const worker = await this.ocrWorker;
      const pages = await this.convertPdfToImages(filePath);
      let fullText = '';

      for (const page of pages) {
        const { data: { text } } = await worker.recognize(page);
        fullText += text + '\n';
      }

      return fullText;
    } catch (error) {
      this.logger.error(`OCR processing failed: ${error.message}`);
      throw error;
    }
  }

  private async convertPdfToImages(filePath: string): Promise<Buffer[]> {
    // Implementation depends on the PDF to image conversion library
    // This is a placeholder that would need to be implemented
    return [];
  }

  private async parseBankStatement(text: string, options: DocumentParserOptions): Promise<DocumentParserResult> {
    const result: DocumentParserResult = {
      success: true,
      transactions: [],
      metadata: {
        documentType: DocumentType.BANK_STATEMENT,
        currency: options.currency || 'KES',
      }
    };

    try {
      // Extract account information
      result.metadata.accountNumber = this.extractAccountNumber(text);
      result.metadata.accountName = this.extractAccountName(text);
      result.metadata.bankName = this.extractBankName(text);

      // Extract statement period
      const period = this.extractStatementPeriod(text);
      if (period) {
        result.metadata.statementPeriod = period;
      }

      // Extract balances
      result.metadata.openingBalance = this.extractOpeningBalance(text);
      result.metadata.closingBalance = this.extractClosingBalance(text);

      // Extract transactions
      result.transactions = this.extractBankTransactions(text, options);

      // Calculate totals
      result.metadata.totalCredits = this.calculateTotalCredits(result.transactions);
      result.metadata.totalDebits = this.calculateTotalDebits(result.transactions);

      // Calculate confidence score based on data completeness
      result.metadata.confidence = this.calculateConfidence(result);

      return result;
    } catch (error) {
      this.logger.error(`Bank statement parsing failed: ${error.message}`);
      return {
        success: false,
        error: {
          code: 'BANK_STATEMENT_PARSE_ERROR',
          message: error.message,
          details: error.stack
        }
      };
    }
  }

  private async parseMpesaStatement(text: string, options: DocumentParserOptions): Promise<DocumentParserResult> {
    // Similar to parseBankStatement but with M-Pesa specific logic
    // This would be implemented in the M-Pesa parser
    throw new Error('M-Pesa statement parsing not implemented in PDF parser');
  }

  private async parseSaccoStatement(text: string, options: DocumentParserOptions): Promise<DocumentParserResult> {
    // Similar to parseBankStatement but with SACCO specific logic
    // This would be implemented in the SACCO parser
    throw new Error('SACCO statement parsing not implemented in PDF parser');
  }

  private async parseGenericDocument(text: string, options: DocumentParserOptions): Promise<DocumentParserResult> {
    return {
      success: true,
      metadata: {
        documentType: options.documentType,
        extractedText: text,
        confidence: 1.0
      }
    };
  }

  private extractAccountNumber(text: string): string | undefined {
    const patterns = [
      /Account(?:\s+No\.?|Number):?\s*([A-Z0-9-]+)/i,
      /A\/C\s*(?:No\.?|Number):?\s*([A-Z0-9-]+)/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[1].trim();
    }

    return undefined;
  }

  private extractAccountName(text: string): string | undefined {
    const patterns = [
      /Account(?:\s+Name):?\s*([A-Za-z\s]+)/i,
      /Name:?\s*([A-Za-z\s]+)/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[1].trim();
    }

    return undefined;
  }

  private extractBankName(text: string): string | undefined {
    // Add common Kenyan banks
    const banks = [
      'Equity Bank',
      'KCB Bank',
      'Co-operative Bank',
      'Standard Chartered',
      'Barclays Bank',
      'ABSA Bank',
      'Family Bank',
      'National Bank'
    ];

    for (const bank of banks) {
      if (text.includes(bank)) return bank;
    }

    return undefined;
  }

  private extractStatementPeriod(text: string): { start: Date; end: Date } | undefined {
    const patterns = [
      /Statement Period:?\s*(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})\s*(?:to|-)\s*(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})/i,
      /Period:?\s*(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})\s*(?:to|-)\s*(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const start = moment(match[1], ['DD-MM-YYYY', 'DD/MM/YYYY', 'MM-DD-YYYY', 'MM/DD/YYYY']).toDate();
        const end = moment(match[2], ['DD-MM-YYYY', 'DD/MM/YYYY', 'MM-DD-YYYY', 'MM/DD/YYYY']).toDate();
        if (start && end) return { start, end };
      }
    }

    return undefined;
  }

  private extractOpeningBalance(text: string): number | undefined {
    const patterns = [
      /Opening Balance:?\s*(?:KES|Ksh|KSh)?\.?\s*([\d,]+\.?\d*)/i,
      /Balance [Bb]\/[Ff]:?\s*(?:KES|Ksh|KSh)?\.?\s*([\d,]+\.?\d*)/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return parseFloat(match[1].replace(/,/g, ''));
    }

    return undefined;
  }

  private extractClosingBalance(text: string): number | undefined {
    const patterns = [
      /Closing Balance:?\s*(?:KES|Ksh|KSh)?\.?\s*([\d,]+\.?\d*)/i,
      /Balance [Cc]\/[Ff]:?\s*(?:KES|Ksh|KSh)?\.?\s*([\d,]+\.?\d*)/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return parseFloat(match[1].replace(/,/g, ''));
    }

    return undefined;
  }

  private extractBankTransactions(text: string, options: DocumentParserOptions): any[] {
    const transactions = [];
    const lines = text.split('\n');
    
    // Common date formats in Kenyan bank statements
    const dateFormats = [
      'DD-MM-YYYY',
      'DD/MM/YYYY',
      'DD.MM.YYYY',
      'YYYY-MM-DD',
      'DD MMM YYYY'
    ];

    // Transaction pattern matching
    const transactionPattern = /(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})\s+(.+?)\s+([\d,]+\.?\d*)\s*(?:DR|CR)?\s*([\d,]+\.?\d*)?/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(transactionPattern);

      if (match) {
        const [_, dateStr, description, amount, balance] = match;
        let transactionDate: Date | null = null;

        // Try parsing the date with different formats
        for (const format of dateFormats) {
          const parsed = moment(dateStr, format);
          if (parsed.isValid()) {
            transactionDate = parsed.toDate();
            break;
          }
        }

        if (transactionDate) {
          const transaction = {
            transaction_date: transactionDate,
            description: description.trim(),
            amount: parseFloat(amount.replace(/,/g, '')),
            balance_after: balance ? parseFloat(balance.replace(/,/g, '')) : undefined,
            transaction_type: this.determineTransactionType(description, amount),
            category: this.categorizeTransaction(description),
            metadata: {}
          };

          // Apply custom extractors if provided
          if (options.customExtractors) {
            for (const [key, extractor] of Object.entries(options.customExtractors)) {
              transaction.metadata[key] = extractor(line);
            }
          }

          transactions.push(transaction);
        }
      }
    }

    return transactions;
  }

  private determineTransactionType(description: string, amount: string): string {
    const amountNum = parseFloat(amount.replace(/,/g, ''));
    const desc = description.toLowerCase();

    if (desc.includes('salary') || desc.includes('payment received')) {
      return 'CREDIT';
    } else if (desc.includes('withdrawal') || desc.includes('atm')) {
      return 'WITHDRAWAL';
    } else if (desc.includes('transfer')) {
      return 'TRANSFER';
    } else if (desc.includes('deposit')) {
      return 'DEPOSIT';
    } else if (desc.includes('fee') || desc.includes('charge')) {
      return 'FEE';
    } else {
      return amountNum >= 0 ? 'CREDIT' : 'DEBIT';
    }
  }

  private categorizeTransaction(description: string): string {
    const desc = description.toLowerCase();
    
    if (desc.includes('salary') || desc.includes('payroll')) {
      return 'INCOME';
    } else if (desc.includes('rent') || desc.includes('house')) {
      return 'HOUSING';
    } else if (desc.includes('mpesa') || desc.includes('mobile money')) {
      return 'MOBILE_MONEY';
    } else if (desc.includes('atm') || desc.includes('withdrawal')) {
      return 'CASH';
    } else if (desc.includes('loan') || desc.includes('credit')) {
      return 'LOAN';
    } else if (desc.includes('school') || desc.includes('college')) {
      return 'EDUCATION';
    } else if (desc.includes('hospital') || desc.includes('medical')) {
      return 'HEALTHCARE';
    } else if (desc.includes('shop') || desc.includes('store') || desc.includes('market')) {
      return 'SHOPPING';
    } else if (desc.includes('transfer')) {
      return 'TRANSFER';
    } else {
      return 'OTHER';
    }
  }

  private calculateTotalCredits(transactions: any[]): number {
    return transactions
      .filter(t => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);
  }

  private calculateTotalDebits(transactions: any[]): number {
    return transactions
      .filter(t => t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  }

  private calculateConfidence(result: DocumentParserResult): number {
    let score = 0;
    let totalChecks = 0;

    // Check for essential metadata
    if (result.metadata?.accountNumber) { score++; }
    if (result.metadata?.accountName) { score++; }
    if (result.metadata?.bankName) { score++; }
    if (result.metadata?.statementPeriod) { score++; }
    if (result.metadata?.openingBalance !== undefined) { score++; }
    if (result.metadata?.closingBalance !== undefined) { score++; }
    totalChecks += 6;

    // Check transactions
    if (result.transactions && result.transactions.length > 0) {
      score++;
      
      // Check transaction completeness
      const transactionChecks = result.transactions.every(t => 
        t.transaction_date && 
        t.description &&
        t.amount !== undefined &&
        t.transaction_type
      );
      
      if (transactionChecks) score++;
      totalChecks += 2;
    }

    return totalChecks > 0 ? score / totalChecks : 0;
  }
}
