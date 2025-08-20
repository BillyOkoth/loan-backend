import { Injectable, Logger } from '@nestjs/common';
import { DocumentType } from '../../entities/financial-documents.entity';
import { DocumentParser, DocumentParserResult, DocumentParserOptions, ParsedTransaction } from '../interfaces/parser.interface';
import * as pdfParse from 'pdf-parse';
import * as fs from 'fs';
import * as path from 'path';
import * as moment from 'moment-timezone';

interface MPesaTransaction {
  receipt: string;
  date: Date;
  description: string;
  type: string;
  amount: number;
  balance: number;
  category: string;
  party?: string;
  phoneNumber?: string;
}

@Injectable()
export class MPesaParser implements DocumentParser {
  private readonly logger = new Logger(MPesaParser.name);
  private readonly supportedTypes = ['.pdf', '.csv'];

  // M-Pesa transaction types and their categories
  private readonly transactionTypes = {
    'send_money': ['sent to', 'transfer to', 'send money to'],
    'receive_money': ['received from', 'transfer from', 'money received'],
    'pay_bill': ['pay bill', 'paybill', 'bill payment'],
    'buy_goods': ['buy goods', 'till number', 'merchant'],
    'withdraw': ['withdraw', 'withdrawal at'],
    'deposit': ['deposit', 'agent deposit', 'float'],
    'airtime': ['airtime', 'top up', 'safaricom'],
    'loan': ['fuliza', 'mshwari', 'kcb mpesa', 'loan']
  };

  canHandle(fileType: string, documentType: DocumentType): boolean {
    return this.supportedTypes.includes(path.extname(fileType).toLowerCase()) &&
           documentType === DocumentType.MPESA_STATEMENT;
  }

  async parse(filePath: string, options: DocumentParserOptions): Promise<DocumentParserResult> {
    try {
      this.logger.debug(`Starting M-Pesa statement parsing for file: ${filePath}`);
      const startTime = Date.now();

      let transactions: MPesaTransaction[] = [];
      let metadata: any = {};

      if (filePath.endsWith('.pdf')) {
        const result = await this.parsePdfStatement(filePath);
        transactions = result.transactions;
        metadata = result.metadata;
      } else if (filePath.endsWith('.csv')) {
        const result = await this.parseCsvStatement(filePath);
        transactions = result.transactions;
        metadata = result.metadata;
      }

      // Convert to standard transaction format
      const standardTransactions = this.convertToStandardFormat(transactions);

      // Calculate statistics
      const stats = this.calculateStatistics(transactions);

      return {
        success: true,
        transactions: standardTransactions,
        metadata: {
          ...metadata,
          ...stats,
          documentType: DocumentType.MPESA_STATEMENT,
          currency: 'KES',
          processingTime: Date.now() - startTime,
          confidence: this.calculateConfidence(standardTransactions, metadata)
        }
      };
    } catch (error) {
      this.logger.error(`M-Pesa statement parsing failed: ${error.message}`, error.stack);
      return {
        success: false,
        error: {
          code: 'MPESA_PARSE_ERROR',
          message: error.message,
          details: error.stack
        }
      };
    }
  }

  async validateDocument(filePath: string): Promise<boolean> {
    try {
      if (filePath.endsWith('.pdf')) {
        const content = await this.extractTextFromPdf(filePath);
        return this.isValidMPesaStatement(content);
      } else if (filePath.endsWith('.csv')) {
        const content = fs.readFileSync(filePath, 'utf-8');
        return this.isValidMPesaCsv(content);
      }
      return false;
    } catch (error) {
      this.logger.error(`M-Pesa statement validation failed: ${error.message}`);
      return false;
    }
  }

  async extractMetadata(filePath: string): Promise<Record<string, any>> {
    try {
      if (filePath.endsWith('.pdf')) {
        const content = await this.extractTextFromPdf(filePath);
        return this.extractPdfMetadata(content);
      } else if (filePath.endsWith('.csv')) {
        const content = fs.readFileSync(filePath, 'utf-8');
        return this.extractCsvMetadata(content);
      }
      return {};
    } catch (error) {
      this.logger.error(`Metadata extraction failed: ${error.message}`);
      return {};
    }
  }

  private async parsePdfStatement(filePath: string): Promise<{ transactions: MPesaTransaction[]; metadata: any }> {
    const content = await this.extractTextFromPdf(filePath);
    const lines = content.split('\n');

    const metadata = this.extractPdfMetadata(content);
    const transactions: MPesaTransaction[] = [];

    let currentTransaction: Partial<MPesaTransaction> = {};
    const transactionPattern = /(\w+\s+\d{1,2},\s+\d{4})\s+(\d{2}:\d{2}\s*(?:AM|PM)?)\s+([\w\s]+)\s+(\d+)\s+(-?\d+(?:,\d{3})*(?:\.\d{2})?)\s+(-?\d+(?:,\d{3})*(?:\.\d{2})?)/i;

    for (const line of lines) {
      const match = line.match(transactionPattern);
      if (match) {
        if (Object.keys(currentTransaction).length > 0) {
          transactions.push(currentTransaction as MPesaTransaction);
          currentTransaction = {};
        }

        const [_, dateStr, timeStr, description, receipt, amountStr, balanceStr] = match;
        const amount = parseFloat(amountStr.replace(/,/g, ''));
        const balance = parseFloat(balanceStr.replace(/,/g, ''));
        const date = moment(`${dateStr} ${timeStr}`, ['MMMM D, YYYY hh:mm A', 'MMMM D, YYYY HH:mm']).toDate();

        currentTransaction = {
          receipt,
          date,
          description: description.trim(),
          type: this.determineTransactionType(description),
          amount,
          balance,
          category: this.categorizeTransaction(description),
          ...this.extractPartyDetails(description)
        };
      } else if (Object.keys(currentTransaction).length > 0) {
        // Additional transaction details in subsequent lines
        const details = this.extractAdditionalDetails(line);
        currentTransaction = { ...currentTransaction, ...details };
      }
    }

    // Add last transaction if exists
    if (Object.keys(currentTransaction).length > 0) {
      transactions.push(currentTransaction as MPesaTransaction);
    }

    return { transactions, metadata };
  }

  private async parseCsvStatement(filePath: string): Promise<{ transactions: MPesaTransaction[]; metadata: any }> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

    const metadata = this.extractCsvMetadata(content);
    const transactions: MPesaTransaction[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = line.split(',').map(v => v.trim());
      const record = headers.reduce((acc, header, index) => {
        acc[header] = values[index];
        return acc;
      }, {});

      const transaction: MPesaTransaction = {
        receipt: record['receipt'] || record['transaction id'],
        date: this.parseDate(record['date'] || record['completion time']),
        description: record['description'] || record['details'],
        type: this.determineTransactionType(record['description'] || record['details']),
        amount: parseFloat((record['amount'] || '0').replace(/,/g, '')),
        balance: parseFloat((record['balance'] || '0').replace(/,/g, '')),
        category: this.categorizeTransaction(record['description'] || record['details']),
        ...this.extractPartyDetails(record['description'] || record['details'])
      };

      transactions.push(transaction);
    }

    return { transactions, metadata };
  }

  private async extractTextFromPdf(filePath: string): Promise<string> {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    return data.text;
  }

  private determineTransactionType(description: string): string {
    const desc = description.toLowerCase();
    
    for (const [type, patterns] of Object.entries(this.transactionTypes)) {
      if (patterns.some(pattern => desc.includes(pattern))) {
        return type.toUpperCase();
      }
    }

    return 'OTHER';
  }

  private categorizeTransaction(description: string): string {
    const desc = description.toLowerCase();

    if (desc.includes('loan') || desc.includes('fuliza') || desc.includes('mshwari')) {
      return 'LOAN';
    } else if (desc.includes('pay bill') || desc.includes('paybill')) {
      return 'BILL_PAYMENT';
    } else if (desc.includes('buy goods') || desc.includes('till number')) {
      return 'SHOPPING';
    } else if (desc.includes('withdraw')) {
      return 'WITHDRAWAL';
    } else if (desc.includes('deposit')) {
      return 'DEPOSIT';
    } else if (desc.includes('airtime') || desc.includes('safaricom')) {
      return 'AIRTIME';
    } else if (desc.includes('sent to') || desc.includes('transfer to')) {
      return 'SEND_MONEY';
    } else if (desc.includes('received from') || desc.includes('transfer from')) {
      return 'RECEIVE_MONEY';
    }

    return 'OTHER';
  }

  private extractPartyDetails(description: string): { party?: string; phoneNumber?: string } {
    const result: { party?: string; phoneNumber?: string } = {};

    // Extract phone number
    const phoneMatch = description.match(/(?:\+254|0)?7\d{8}/);
    if (phoneMatch) {
      result.phoneNumber = phoneMatch[0];
    }

    // Extract party name
    const partyPatterns = [
      /(?:sent to|received from|transfer (?:to|from))\s+([A-Z\s]+)/i,
      /(?:pay bill|paybill)\s+to\s+([A-Z\s]+)/i,
      /(?:buy goods)\s+from\s+([A-Z\s]+)/i
    ];

    for (const pattern of partyPatterns) {
      const match = description.match(pattern);
      if (match) {
        result.party = match[1].trim();
        break;
      }
    }

    return result;
  }

  private extractAdditionalDetails(line: string): Partial<MPesaTransaction> {
    const details: Partial<MPesaTransaction> = {};
    
    // Extract phone number if present
    const phoneMatch = line.match(/(?:\+254|0)?7\d{8}/);
    if (phoneMatch) {
      details.phoneNumber = phoneMatch[0];
    }

    // Extract party name if present
    const partyMatch = line.match(/(?:Name|Party):\s+([A-Z\s]+)/i);
    if (partyMatch) {
      details.party = partyMatch[1].trim();
    }

    return details;
  }

  private parseDate(dateStr: string): Date {
    const formats = [
      'DD/MM/YYYY HH:mm:ss',
      'DD-MM-YYYY HH:mm:ss',
      'YYYY-MM-DD HH:mm:ss',
      'MMMM D, YYYY HH:mm:ss',
      'MMMM D, YYYY hh:mm A'
    ];

    for (const format of formats) {
      const parsed = moment(dateStr, format);
      if (parsed.isValid()) {
        return parsed.toDate();
      }
    }

    throw new Error(`Unable to parse date: ${dateStr}`);
  }

  private convertToStandardFormat(transactions: MPesaTransaction[]): ParsedTransaction[] {
    return transactions.map(t => ({
      transaction_date: t.date,
      description: t.description,
      amount: t.amount,
      balance_after: t.balance,
      transaction_type: t.type,
      category: t.category,
      reference: t.receipt,
      metadata: {
        party: t.party,
        phoneNumber: t.phoneNumber
      }
    }));
  }

  private calculateStatistics(transactions: MPesaTransaction[]): any {
    const stats = {
      totalTransactions: transactions.length,
      totalSent: 0,
      totalReceived: 0,
      totalWithdrawn: 0,
      totalDeposited: 0,
      totalBillPayments: 0,
      totalAirtime: 0,
      transactionsByType: {},
      transactionsByCategory: {},
      averageTransactionAmount: 0,
      mostFrequentTransactionType: '',
      mostFrequentCategory: '',
      dateRange: {
        start: null as Date | null,
        end: null as Date | null
      }
    };

    if (transactions.length === 0) return stats;

    // Sort transactions by date
    const sortedTransactions = [...transactions].sort((a, b) => a.date.getTime() - b.date.getTime());
    stats.dateRange.start = sortedTransactions[0].date;
    stats.dateRange.end = sortedTransactions[sortedTransactions.length - 1].date;

    // Calculate totals and frequencies
    transactions.forEach(t => {
      // Update type frequencies
      stats.transactionsByType[t.type] = (stats.transactionsByType[t.type] || 0) + 1;
      stats.transactionsByCategory[t.category] = (stats.transactionsByCategory[t.category] || 0) + 1;

      // Update totals based on type
      switch (t.type) {
        case 'SEND_MONEY':
          stats.totalSent += Math.abs(t.amount);
          break;
        case 'RECEIVE_MONEY':
          stats.totalReceived += t.amount;
          break;
        case 'WITHDRAW':
          stats.totalWithdrawn += Math.abs(t.amount);
          break;
        case 'DEPOSIT':
          stats.totalDeposited += t.amount;
          break;
        case 'PAY_BILL':
          stats.totalBillPayments += Math.abs(t.amount);
          break;
        case 'AIRTIME':
          stats.totalAirtime += Math.abs(t.amount);
          break;
      }
    });

    // Calculate averages and most frequent
    stats.averageTransactionAmount = transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0) / transactions.length;
    stats.mostFrequentTransactionType = Object.entries(stats.transactionsByType)
      .reduce((a, b) => a[1] > b[1] ? a : b)[0];
    stats.mostFrequentCategory = Object.entries(stats.transactionsByCategory)
      .reduce((a, b) => a[1] > b[1] ? a : b)[0];

    return stats;
  }

  private calculateConfidence(transactions: ParsedTransaction[], metadata: any): number {
    let score = 0;
    let totalChecks = 0;

    // Check for essential metadata
    if (metadata.dateRange?.start && metadata.dateRange?.end) { score++; }
    if (metadata.phoneNumber) { score++; }
    totalChecks += 2;

    // Check transactions
    if (transactions.length > 0) {
      score++;
      
      // Check transaction completeness
      const transactionChecks = transactions.every(t => 
        t.transaction_date && 
        t.description &&
        t.amount !== undefined &&
        t.balance_after !== undefined &&
        t.transaction_type &&
        t.reference
      );
      
      if (transactionChecks) score++;
      totalChecks += 2;

      // Check for M-Pesa specific fields
      const mpesaChecks = transactions.every(t =>
        t.metadata?.party || t.metadata?.phoneNumber
      );

      if (mpesaChecks) score++;
      totalChecks++;
    }

    return totalChecks > 0 ? score / totalChecks : 0;
  }

  private isValidMPesaStatement(content: string): boolean {
    const mpesaIdentifiers = [
      'M-PESA',
      'Safaricom',
      'Statement',
      'Transaction',
      'Receipt',
      'Balance'
    ];

    const contentLower = content.toLowerCase();
    return mpesaIdentifiers.some(id => contentLower.includes(id.toLowerCase()));
  }

  private isValidMPesaCsv(content: string): boolean {
    const requiredHeaders = [
      'receipt',
      'date',
      'description',
      'amount',
      'balance'
    ];

    const headers = content.split('\n')[0].toLowerCase();
    return requiredHeaders.every(header => headers.includes(header));
  }

  private extractPdfMetadata(content: string): any {
    const metadata: any = {};

    // Extract phone number
    const phoneMatch = content.match(/(?:\+254|0)?7\d{8}/);
    if (phoneMatch) {
      metadata.phoneNumber = phoneMatch[0];
    }

    // Extract statement period
    const periodMatch = content.match(/Statement Period:?\s*([^\\n]+)/i);
    if (periodMatch) {
      metadata.statementPeriod = periodMatch[1].trim();
    }

    // Extract account holder name
    const nameMatch = content.match(/(?:Name|Account Holder):?\s*([A-Z\s]+)/i);
    if (nameMatch) {
      metadata.accountHolder = nameMatch[1].trim();
    }

    return metadata;
  }

  private extractCsvMetadata(content: string): any {
    const metadata: any = {};
    const lines = content.split('\n');

    // Assume first few lines might contain metadata
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i].toLowerCase();

      // Extract phone number
      const phoneMatch = line.match(/(?:\+254|0)?7\d{8}/);
      if (phoneMatch) {
        metadata.phoneNumber = phoneMatch[0];
      }

      // Extract statement period
      const periodMatch = line.match(/statement period:?\s*([^,]+)/i);
      if (periodMatch) {
        metadata.statementPeriod = periodMatch[1].trim();
      }

      // Extract account holder name
      const nameMatch = line.match(/(?:name|account holder):?\s*([^,]+)/i);
      if (nameMatch) {
        metadata.accountHolder = nameMatch[1].trim();
      }
    }

    return metadata;
  }
}
