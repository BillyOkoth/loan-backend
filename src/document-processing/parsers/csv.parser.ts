import { Injectable, Logger } from '@nestjs/common';
import { DocumentType } from '../../entities/financial-documents.entity';
import { DocumentParser, DocumentParserResult, DocumentParserOptions, ParsedTransaction } from '../interfaces/parser.interface';
import { parse } from 'csv-parse';
import * as fs from 'fs';
import * as path from 'path';
import * as moment from 'moment-timezone';

interface ColumnMapping {
  date: string[];
  description: string[];
  amount: string[];
  balance?: string[];
  type?: string[];
  reference?: string[];
  category?: string[];
}

@Injectable()
export class CsvParser implements DocumentParser {
  private readonly logger = new Logger(CsvParser.name);
  private readonly supportedTypes = ['.csv'];

  // Common column header mappings for different banks
  private readonly columnMappings: Record<string, ColumnMapping> = {
    'equity_bank': {
      date: ['Transaction Date', 'Date', 'Value Date'],
      description: ['Description', 'Narrative', 'Details', 'Transaction Details'],
      amount: ['Amount', 'Transaction Amount', 'Debit/Credit'],
      balance: ['Running Balance', 'Balance', 'Available Balance'],
      type: ['Transaction Type', 'Type'],
      reference: ['Reference Number', 'Reference', 'Transaction ID']
    },
    'kcb_bank': {
      date: ['Date', 'Transaction Date'],
      description: ['Description', 'Particulars'],
      amount: ['Amount', 'Debit/Credit Amount'],
      balance: ['Balance'],
      reference: ['Reference', 'Cheque No']
    },
    'cooperative_bank': {
      date: ['Value Date', 'Transaction Date'],
      description: ['Transaction Details', 'Narrative'],
      amount: ['Amount', 'Debit/Credit'],
      balance: ['Running Balance'],
      type: ['Transaction Type']
    }
  };

  canHandle(fileType: string, documentType: DocumentType): boolean {
    return this.supportedTypes.includes(path.extname(fileType).toLowerCase());
  }

  async parse(filePath: string, options: DocumentParserOptions): Promise<DocumentParserResult> {
    try {
      this.logger.debug(`Starting CSV parsing for file: ${filePath}`);
      const startTime = Date.now();

      // Read CSV file
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      
      // Detect bank format and get column mapping
      const { headers, records } = await this.parseCSV(fileContent);
      const bankFormat = this.detectBankFormat(headers);
      const columnMapping = this.getColumnMapping(bankFormat, headers);

      if (!columnMapping) {
        throw new Error('Unable to determine CSV format. Unsupported bank statement format.');
      }

      // Process based on document type
      let result: DocumentParserResult;
      switch (options.documentType) {
        case DocumentType.BANK_STATEMENT:
          result = await this.parseBankStatement(records, columnMapping, options);
          break;
        case DocumentType.MPESA_STATEMENT:
          result = await this.parseMpesaStatement(records, columnMapping, options);
          break;
        default:
          result = await this.parseGenericCSV(records, columnMapping, options);
      }

      // Add processing metadata
      result.metadata = {
        ...result.metadata,
        processingTime: Date.now() - startTime,
        bankFormat,
        columnMapping
      };

      return result;
    } catch (error) {
      this.logger.error(`CSV parsing failed: ${error.message}`, error.stack);
      return {
        success: false,
        error: {
          code: 'CSV_PARSE_ERROR',
          message: error.message,
          details: error.stack
        }
      };
    }
  }

  async validateDocument(filePath: string): Promise<boolean> {
    try {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const { headers } = await this.parseCSV(fileContent);
      return this.isValidFormat(headers);
    } catch (error) {
      this.logger.error(`CSV validation failed: ${error.message}`);
      return false;
    }
  }

  async extractMetadata(filePath: string): Promise<Record<string, any>> {
    try {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const { headers, records } = await this.parseCSV(fileContent);
      const bankFormat = this.detectBankFormat(headers);

      return {
        headers,
        rowCount: records.length,
        bankFormat,
        dateRange: this.extractDateRange(records, this.getColumnMapping(bankFormat, headers))
      };
    } catch (error) {
      this.logger.error(`Metadata extraction failed: ${error.message}`);
      return {};
    }
  }

  private async parseCSV(content: string): Promise<{ headers: string[]; records: any[] }> {
    return new Promise((resolve, reject) => {
      parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        skip_records_with_empty_values: true
      }, (error, records) => {
        if (error) {
          reject(error);
        } else {
          const headers = records.length > 0 ? Object.keys(records[0]) : [];
          resolve({ headers, records });
        }
      });
    });
  }

  private detectBankFormat(headers: string[]): string {
    for (const [bank, mapping] of Object.entries(this.columnMappings)) {
      const requiredColumns = [...mapping.date, ...mapping.description, ...mapping.amount];
      if (requiredColumns.some(col => headers.some(h => h.toLowerCase() === col.toLowerCase()))) {
        return bank;
      }
    }
    return 'unknown';
  }

  private getColumnMapping(bankFormat: string, headers: string[]): ColumnMapping | null {
    const mapping = this.columnMappings[bankFormat];
    if (!mapping) return null;

    // Find actual column names that match the mapping
    const result: ColumnMapping = {
      date: [],
      description: [],
      amount: [],
      balance: [],
      type: [],
      reference: []
    };

    for (const [key, possibleNames] of Object.entries(mapping)) {
      const matchedColumn = headers.find(h => 
        possibleNames.some(n => h.toLowerCase() === n.toLowerCase())
      );
      if (matchedColumn) {
        result[key] = [matchedColumn];
      }
    }

    return result;
  }

  private async parseBankStatement(
    records: any[],
    columnMapping: ColumnMapping,
    options: DocumentParserOptions
  ): Promise<DocumentParserResult> {
    const result: DocumentParserResult = {
      success: true,
      transactions: [],
      metadata: {
        documentType: DocumentType.BANK_STATEMENT,
        currency: options.currency || 'KES',
      }
    };

    try {
      // Extract transactions
      result.transactions = await this.extractTransactions(records, columnMapping);

      // Extract metadata
      const dateRange = this.extractDateRange(records, columnMapping);
      if (dateRange) {
        result.metadata.statementPeriod = dateRange;
      }

      // Calculate totals
      const { totalCredits, totalDebits } = this.calculateTotals(result.transactions);
      result.metadata.totalCredits = totalCredits;
      result.metadata.totalDebits = totalDebits;

      // Extract balances
      const { openingBalance, closingBalance } = this.extractBalances(records, columnMapping);
      result.metadata.openingBalance = openingBalance;
      result.metadata.closingBalance = closingBalance;

      // Calculate confidence score
      result.metadata.confidence = this.calculateConfidence(result);

      return result;
    } catch (error) {
      this.logger.error(`Bank statement CSV parsing failed: ${error.message}`);
      return {
        success: false,
        error: {
          code: 'BANK_STATEMENT_CSV_PARSE_ERROR',
          message: error.message,
          details: error.stack
        }
      };
    }
  }

  private async parseMpesaStatement(
    records: any[],
    columnMapping: ColumnMapping,
    options: DocumentParserOptions
  ): Promise<DocumentParserResult> {
    // Similar to parseBankStatement but with M-Pesa specific logic
    throw new Error('M-Pesa statement parsing not implemented in CSV parser');
  }

  private async parseGenericCSV(
    records: any[],
    columnMapping: ColumnMapping,
    options: DocumentParserOptions
  ): Promise<DocumentParserResult> {
    return {
      success: true,
      transactions: await this.extractTransactions(records, columnMapping),
      metadata: {
        documentType: options.documentType,
        confidence: 1.0
      }
    };
  }

  private async extractTransactions(records: any[], columnMapping: ColumnMapping): Promise<ParsedTransaction[]> {
    return records.map(record => {
      const dateStr = this.getFirstValidValue(record, columnMapping.date);
      const description = this.getFirstValidValue(record, columnMapping.description);
      const amountStr = this.getFirstValidValue(record, columnMapping.amount);
      const balanceStr = columnMapping.balance ? this.getFirstValidValue(record, columnMapping.balance) : undefined;
      const type = columnMapping.type ? this.getFirstValidValue(record, columnMapping.type) : undefined;
      const reference = columnMapping.reference ? this.getFirstValidValue(record, columnMapping.reference) : undefined;

      const amount = this.parseAmount(amountStr);
      const balance = balanceStr ? this.parseAmount(balanceStr) : undefined;

      return {
        transaction_date: this.parseDate(dateStr),
        description: description?.trim(),
        amount,
        balance_after: balance,
        transaction_type: type || this.determineTransactionType(description, amount),
        reference,
        category: this.categorizeTransaction(description),
      };
    }).filter(t => t.transaction_date && t.description && t.amount !== undefined);
  }

  private getFirstValidValue(record: any, possibleKeys: string[]): string | undefined {
    for (const key of possibleKeys) {
      if (record[key] !== undefined && record[key] !== null && record[key] !== '') {
        return record[key];
      }
    }
    return undefined;
  }

  private parseDate(dateStr: string): Date | null {
    if (!dateStr) return null;

    const formats = [
      'DD/MM/YYYY',
      'MM/DD/YYYY',
      'YYYY-MM-DD',
      'DD-MM-YYYY',
      'DD.MM.YYYY',
      'DD MMM YYYY',
      'YYYY/MM/DD'
    ];

    for (const format of formats) {
      const parsed = moment(dateStr, format);
      if (parsed.isValid()) {
        return parsed.toDate();
      }
    }

    return null;
  }

  private parseAmount(amountStr: string): number | undefined {
    if (!amountStr) return undefined;

    // Remove currency symbols and commas
    const cleanAmount = amountStr.replace(/[^0-9.-]/g, '');
    const amount = parseFloat(cleanAmount);

    return isNaN(amount) ? undefined : amount;
  }

  private determineTransactionType(description: string, amount: number): string {
    if (!description) return amount >= 0 ? 'CREDIT' : 'DEBIT';

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
    }

    return amount >= 0 ? 'CREDIT' : 'DEBIT';
  }

  private categorizeTransaction(description: string): string {
    if (!description) return 'OTHER';

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
    }

    return 'OTHER';
  }

  private extractDateRange(records: any[], columnMapping: ColumnMapping): { start: Date; end: Date } | undefined {
    if (!records.length || !columnMapping.date.length) return undefined;

    const dates = records
      .map(r => this.parseDate(this.getFirstValidValue(r, columnMapping.date)))
      .filter(d => d !== null) as Date[];

    if (!dates.length) return undefined;

    return {
      start: new Date(Math.min(...dates.map(d => d.getTime()))),
      end: new Date(Math.max(...dates.map(d => d.getTime())))
    };
  }

  private extractBalances(records: any[], columnMapping: ColumnMapping): { openingBalance?: number; closingBalance?: number } {
    if (!records.length || !columnMapping.balance) {
      return {};
    }

    const balances = records
      .map(r => this.parseAmount(this.getFirstValidValue(r, columnMapping.balance)))
      .filter(b => b !== undefined) as number[];

    if (!balances.length) {
      return {};
    }

    return {
      openingBalance: balances[0],
      closingBalance: balances[balances.length - 1]
    };
  }

  private calculateTotals(transactions: ParsedTransaction[]): { totalCredits: number; totalDebits: number } {
    return transactions.reduce((acc, t) => {
      if (t.amount >= 0) {
        acc.totalCredits += t.amount;
      } else {
        acc.totalDebits += Math.abs(t.amount);
      }
      return acc;
    }, { totalCredits: 0, totalDebits: 0 });
  }

  private calculateConfidence(result: DocumentParserResult): number {
    let score = 0;
    let totalChecks = 0;

    // Check for essential metadata
    if (result.metadata?.statementPeriod) { score++; }
    if (result.metadata?.openingBalance !== undefined) { score++; }
    if (result.metadata?.closingBalance !== undefined) { score++; }
    totalChecks += 3;

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

  private isValidFormat(headers: string[]): boolean {
    // Check if the CSV has the minimum required columns for any supported bank format
    for (const mapping of Object.values(this.columnMappings)) {
      const hasRequiredColumns = mapping.date.some(d => headers.includes(d)) &&
        mapping.description.some(d => headers.includes(d)) &&
        mapping.amount.some(d => headers.includes(d));

      if (hasRequiredColumns) return true;
    }

    return false;
  }
}
