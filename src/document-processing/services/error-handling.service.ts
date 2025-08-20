import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { DocumentType } from '../../entities/financial-documents.entity';
import * as fs from 'fs';
import * as path from 'path';

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  code: string;
  message: string;
  field?: string;
  details?: any;
}

export interface ValidationWarning {
  code: string;
  message: string;
  field?: string;
  details?: any;
}

export interface ProcessingError {
  code: string;
  message: string;
  timestamp: Date;
  documentId?: number;
  documentType?: DocumentType;
  filePath?: string;
  stage: string;
  error: Error;
  metadata?: any;
}

@Injectable()
export class ErrorHandlingService {
  private readonly logger = new Logger(ErrorHandlingService.name);
  private readonly errorLog: ProcessingError[] = [];
  private readonly maxLogSize = 1000;

  // Document validation rules
  private readonly validationRules = {
    [DocumentType.BANK_STATEMENT]: {
      requiredFields: ['account_number', 'statement_period', 'transactions'],
      fileTypes: ['.pdf', '.csv'],
      maxSize: 10 * 1024 * 1024, // 10MB
      minTransactions: 1
    },
    [DocumentType.MPESA_STATEMENT]: {
      requiredFields: ['phone_number', 'statement_period', 'transactions'],
      fileTypes: ['.pdf', '.csv'],
      maxSize: 5 * 1024 * 1024, // 5MB
      minTransactions: 1
    },
    [DocumentType.SACCO_STATEMENT]: {
      requiredFields: ['member_number', 'statement_period', 'transactions'],
      fileTypes: ['.pdf', '.csv'],
      maxSize: 5 * 1024 * 1024, // 5MB
      minTransactions: 1
    }
  };

  /**
   * Validate a document before processing
   */
  async validateDocument(
    filePath: string,
    documentType: DocumentType,
    metadata?: any
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        errors.push({
          code: 'FILE_NOT_FOUND',
          message: 'Document file not found',
          field: 'filePath'
        });
        return { isValid: false, errors, warnings };
      }

      // Get file stats
      const stats = fs.statSync(filePath);
      const fileType = path.extname(filePath).toLowerCase();

      // Validate file type
      const rules = this.validationRules[documentType];
      if (!rules.fileTypes.includes(fileType)) {
        errors.push({
          code: 'INVALID_FILE_TYPE',
          message: `File type ${fileType} not supported for ${documentType}. Supported types: ${rules.fileTypes.join(', ')}`,
          field: 'fileType',
          details: { supportedTypes: rules.fileTypes }
        });
      }

      // Validate file size
      if (stats.size > rules.maxSize) {
        errors.push({
          code: 'FILE_TOO_LARGE',
          message: `File size exceeds maximum allowed size of ${rules.maxSize / 1024 / 1024}MB`,
          field: 'fileSize',
          details: { maxSize: rules.maxSize, actualSize: stats.size }
        });
      }

      // Validate metadata if provided
      if (metadata) {
        const metadataValidation = this.validateMetadata(metadata, documentType);
        errors.push(...metadataValidation.errors);
        warnings.push(...metadataValidation.warnings);
      }

      // Add warnings for potential issues
      if (stats.size < 1024) { // Less than 1KB
        warnings.push({
          code: 'SMALL_FILE_SIZE',
          message: 'File size is unusually small, might be corrupted or empty',
          field: 'fileSize',
          details: { size: stats.size }
        });
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings
      };
    } catch (error) {
      this.logger.error(`Validation failed: ${error.message}`, error.stack);
      errors.push({
        code: 'VALIDATION_ERROR',
        message: 'Document validation failed',
        details: error.message
      });
      return { isValid: false, errors, warnings };
    }
  }

  /**
   * Handle processing errors
   */
  handleProcessingError(error: Error, context: {
    documentId?: number;
    documentType?: DocumentType;
    filePath?: string;
    stage: string;
    metadata?: any;
  }): HttpException {
    const processingError: ProcessingError = {
      code: this.determineErrorCode(error),
      message: error.message,
      timestamp: new Date(),
      ...context,
      error
    };

    // Log error
    this.logError(processingError);

    // Determine HTTP status
    const status = this.determineHttpStatus(processingError.code);

    // Create error response
    const errorResponse = {
      code: processingError.code,
      message: processingError.message,
      timestamp: processingError.timestamp,
      documentType: processingError.documentType,
      stage: processingError.stage
    };

    return new HttpException(errorResponse, status);
  }

  /**
   * Validate extracted data
   */
  validateExtractedData(data: any, documentType: DocumentType): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    const rules = this.validationRules[documentType];

    // Check required fields
    for (const field of rules.requiredFields) {
      if (!data[field]) {
        errors.push({
          code: 'MISSING_REQUIRED_FIELD',
          message: `Required field '${field}' is missing`,
          field
        });
      }
    }

    // Validate transactions
    if (data.transactions) {
      if (data.transactions.length < rules.minTransactions) {
        errors.push({
          code: 'INSUFFICIENT_TRANSACTIONS',
          message: `At least ${rules.minTransactions} transaction(s) required`,
          field: 'transactions',
          details: { count: data.transactions.length }
        });
      }

      // Validate individual transactions
      data.transactions.forEach((transaction, index) => {
        const transactionValidation = this.validateTransaction(transaction, index);
        errors.push(...transactionValidation.errors);
        warnings.push(...transactionValidation.warnings);
      });
    }

    // Document type specific validations
    switch (documentType) {
      case DocumentType.BANK_STATEMENT:
        this.validateBankStatement(data, errors, warnings);
        break;
      case DocumentType.MPESA_STATEMENT:
        this.validateMpesaStatement(data, errors, warnings);
        break;
      case DocumentType.SACCO_STATEMENT:
        this.validateSaccoStatement(data, errors, warnings);
        break;
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get recent processing errors
   */
  getRecentErrors(limit: number = 10): ProcessingError[] {
    return this.errorLog.slice(-limit);
  }

  /**
   * Clear error log
   */
  clearErrorLog(): void {
    this.errorLog.length = 0;
  }

  /**
   * Validate metadata
   */
  private validateMetadata(
    metadata: any,
    documentType: DocumentType
  ): { errors: ValidationError[]; warnings: ValidationWarning[] } {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Common metadata validations
    if (metadata.processingTime && metadata.processingTime > 30000) { // 30 seconds
      warnings.push({
        code: 'HIGH_PROCESSING_TIME',
        message: 'Document processing time is unusually high',
        field: 'processingTime',
        details: { time: metadata.processingTime }
      });
    }

    if (metadata.confidence && metadata.confidence < 0.7) {
      warnings.push({
        code: 'LOW_CONFIDENCE',
        message: 'Document processing confidence is low',
        field: 'confidence',
        details: { confidence: metadata.confidence }
      });
    }

    // Document type specific metadata validations
    switch (documentType) {
      case DocumentType.BANK_STATEMENT:
        if (!metadata.bankName) {
          warnings.push({
            code: 'MISSING_BANK_NAME',
            message: 'Bank name not detected in metadata',
            field: 'bankName'
          });
        }
        break;

      case DocumentType.MPESA_STATEMENT:
        if (!metadata.phoneNumber) {
          errors.push({
            code: 'MISSING_PHONE_NUMBER',
            message: 'Phone number not found in metadata',
            field: 'phoneNumber'
          });
        }
        break;

      case DocumentType.SACCO_STATEMENT:
        if (!metadata.memberNumber) {
          errors.push({
            code: 'MISSING_MEMBER_NUMBER',
            message: 'SACCO member number not found in metadata',
            field: 'memberNumber'
          });
        }
        break;
    }

    return { errors, warnings };
  }

  /**
   * Validate a single transaction
   */
  private validateTransaction(
    transaction: any,
    index: number
  ): { errors: ValidationError[]; warnings: ValidationWarning[] } {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Required fields
    const requiredFields = ['date', 'amount', 'description'];
    for (const field of requiredFields) {
      if (!transaction[field]) {
        errors.push({
          code: 'MISSING_TRANSACTION_FIELD',
          message: `Required transaction field '${field}' is missing`,
          field,
          details: { transactionIndex: index }
        });
      }
    }

    // Date validation
    if (transaction.date) {
      const date = new Date(transaction.date);
      if (isNaN(date.getTime())) {
        errors.push({
          code: 'INVALID_DATE',
          message: 'Invalid transaction date',
          field: 'date',
          details: { transactionIndex: index, value: transaction.date }
        });
      } else if (date > new Date()) {
        warnings.push({
          code: 'FUTURE_DATE',
          message: 'Transaction date is in the future',
          field: 'date',
          details: { transactionIndex: index, date }
        });
      }
    }

    // Amount validation
    if (transaction.amount !== undefined) {
      if (typeof transaction.amount !== 'number') {
        errors.push({
          code: 'INVALID_AMOUNT',
          message: 'Transaction amount must be a number',
          field: 'amount',
          details: { transactionIndex: index, value: transaction.amount }
        });
      } else if (transaction.amount === 0) {
        warnings.push({
          code: 'ZERO_AMOUNT',
          message: 'Transaction amount is zero',
          field: 'amount',
          details: { transactionIndex: index }
        });
      }
    }

    // Description validation
    if (transaction.description && transaction.description.length < 3) {
      warnings.push({
        code: 'SHORT_DESCRIPTION',
        message: 'Transaction description is unusually short',
        field: 'description',
        details: { transactionIndex: index, length: transaction.description.length }
      });
    }

    return { errors, warnings };
  }

  /**
   * Validate bank statement specific data
   */
  private validateBankStatement(
    data: any,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    // Validate account number
    if (data.account_number && !/^\d{6,}$/.test(data.account_number)) {
      warnings.push({
        code: 'INVALID_ACCOUNT_NUMBER_FORMAT',
        message: 'Account number format is unusual',
        field: 'account_number'
      });
    }

    // Validate statement period
    if (data.statement_period) {
      const { start, end } = data.statement_period;
      if (new Date(start) > new Date(end)) {
        errors.push({
          code: 'INVALID_STATEMENT_PERIOD',
          message: 'Statement end date is before start date',
          field: 'statement_period'
        });
      }
    }

    // Validate balances
    if (data.opening_balance !== undefined && data.closing_balance !== undefined) {
      const totalCredits = data.transactions
        .filter(t => t.amount > 0)
        .reduce((sum, t) => sum + t.amount, 0);
      
      const totalDebits = data.transactions
        .filter(t => t.amount < 0)
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);

      const expectedClosingBalance = data.opening_balance + totalCredits - totalDebits;
      
      if (Math.abs(expectedClosingBalance - data.closing_balance) > 0.01) {
        warnings.push({
          code: 'BALANCE_MISMATCH',
          message: 'Closing balance does not match transaction totals',
          field: 'closing_balance',
          details: {
            expected: expectedClosingBalance,
            actual: data.closing_balance,
            difference: Math.abs(expectedClosingBalance - data.closing_balance)
          }
        });
      }
    }
  }

  /**
   * Validate M-Pesa statement specific data
   */
  private validateMpesaStatement(
    data: any,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    // Validate phone number
    if (data.phone_number && !/^(?:\+254|0)?7\d{8}$/.test(data.phone_number)) {
      errors.push({
        code: 'INVALID_PHONE_NUMBER',
        message: 'Invalid M-Pesa phone number format',
        field: 'phone_number'
      });
    }

    // Validate transaction types
    const validTypes = ['send', 'receive', 'withdraw', 'deposit', 'pay', 'airtime'];
    data.transactions.forEach((transaction, index) => {
      if (transaction.type && !validTypes.includes(transaction.type.toLowerCase())) {
        warnings.push({
          code: 'UNKNOWN_TRANSACTION_TYPE',
          message: 'Unknown M-Pesa transaction type',
          field: 'type',
          details: { transactionIndex: index, type: transaction.type }
        });
      }
    });
  }

  /**
   * Validate SACCO statement specific data
   */
  private validateSaccoStatement(
    data: any,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    // Validate member number
    if (data.member_number && !/^[A-Z0-9-]{4,}$/.test(data.member_number)) {
      warnings.push({
        code: 'INVALID_MEMBER_NUMBER_FORMAT',
        message: 'SACCO member number format is unusual',
        field: 'member_number'
      });
    }

    // Validate share calculations
    if (data.total_shares !== undefined) {
      const shareTransactions = data.transactions
        .filter(t => t.type === 'SHARES')
        .reduce((sum, t) => sum + t.amount, 0);

      if (Math.abs(data.total_shares - shareTransactions) > 0.01) {
        warnings.push({
          code: 'SHARES_MISMATCH',
          message: 'Total shares does not match share transactions',
          field: 'total_shares',
          details: {
            expected: shareTransactions,
            actual: data.total_shares,
            difference: Math.abs(data.total_shares - shareTransactions)
          }
        });
      }
    }
  }

  /**
   * Log processing error
   */
  private logError(error: ProcessingError): void {
    this.errorLog.push(error);
    
    // Keep log size under limit
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog.shift();
    }

    // Log to system logger
    this.logger.error(
      `Processing error: ${error.code} - ${error.message}`,
      {
        documentId: error.documentId,
        documentType: error.documentType,
        stage: error.stage,
        timestamp: error.timestamp,
        stack: error.error.stack
      }
    );
  }

  /**
   * Determine error code from error
   */
  private determineErrorCode(error: Error): string {
    if (error instanceof HttpException) {
      return error.getResponse()['code'] || 'HTTP_ERROR';
    }

    if (error.name === 'ValidationError') {
      return 'VALIDATION_ERROR';
    }

    if (error.message.includes('ENOENT')) {
      return 'FILE_NOT_FOUND';
    }

    if (error.message.includes('permission')) {
      return 'PERMISSION_DENIED';
    }

    return 'PROCESSING_ERROR';
  }

  /**
   * Determine HTTP status from error code
   */
  private determineHttpStatus(code: string): number {
    switch (code) {
      case 'FILE_NOT_FOUND':
        return HttpStatus.NOT_FOUND;
      case 'PERMISSION_DENIED':
        return HttpStatus.FORBIDDEN;
      case 'VALIDATION_ERROR':
        return HttpStatus.BAD_REQUEST;
      case 'PROCESSING_ERROR':
        return HttpStatus.INTERNAL_SERVER_ERROR;
      default:
        return HttpStatus.INTERNAL_SERVER_ERROR;
    }
  }
}
