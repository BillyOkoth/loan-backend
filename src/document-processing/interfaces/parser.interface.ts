import { DocumentType } from '../../entities/financial-documents.entity';

export interface ParsedTransaction {
  transaction_date: Date;
  description: string;
  amount: number;
  reference?: string;
  balance_after?: number;
  transaction_type?: string;
  category?: string;
  metadata?: Record<string, any>;
}

export interface DocumentParserResult {
  success: boolean;
  transactions?: ParsedTransaction[];
  metadata?: {
    accountNumber?: string;
    accountName?: string;
    bankName?: string;
    statementPeriod?: {
      start: Date;
      end: Date;
    };
    openingBalance?: number;
    closingBalance?: number;
    totalCredits?: number;
    totalDebits?: number;
    currency?: string;
    documentType?: DocumentType;
    extractedText?: string;
    confidence?: number;
    processingTime?: number;
  };
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface DocumentParser {
  canHandle(fileType: string, documentType: DocumentType): boolean;
  parse(filePath: string, options?: DocumentParserOptions): Promise<DocumentParserResult>;
  validateDocument(filePath: string): Promise<boolean>;
  extractMetadata(filePath: string): Promise<Record<string, any>>;
}

export interface DocumentParserOptions {
  documentType: DocumentType;
  extractText?: boolean;
  validateStructure?: boolean;
  ocrEnabled?: boolean;
  confidenceThreshold?: number;
  maxPages?: number;
  timeout?: number;
  customExtractors?: Record<string, (text: string) => any>;
  dateFormat?: string;
  currency?: string;
  language?: string;
  metadata?: Record<string, any>;
}
