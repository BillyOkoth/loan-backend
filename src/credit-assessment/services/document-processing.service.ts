import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
// TODO: Install pdf-parse and csv-parser in Docker container
// import * as pdfParse from 'pdf-parse';
// import * as csv from 'csv-parser';
import { FinancialDocuments, DocumentType, ProcessingStatus } from '../../entities/financial-documents.entity';
import { DocumentProcessingQueue, QueueStatus } from '../../entities/document-processing-queue.entity';
import { TransactionHistory, SourceType, TransactionType } from '../../entities/transaction-history.entity';

export interface ProcessingResult {
  success: boolean;
  extractedData?: any;
  transactionsExtracted?: number;
  error?: string;
}

@Injectable()
export class DocumentProcessingService {
  private readonly logger = new Logger(DocumentProcessingService.name);

  constructor(
    @InjectRepository(FinancialDocuments)
    private readonly financialDocumentsRepository: Repository<FinancialDocuments>,
    @InjectRepository(DocumentProcessingQueue)
    private readonly processingQueueRepository: Repository<DocumentProcessingQueue>,
    @InjectRepository(TransactionHistory)
    private readonly transactionHistoryRepository: Repository<TransactionHistory>,
  ) {}

  async processDocument(documentId: number): Promise<ProcessingResult> {
    const document = await this.financialDocumentsRepository.findOne({
      where: { document_id: documentId }
    });

    if (!document) {
      throw new Error('Document not found');
    }

    try {
      // Update status to processing
      await this.updateDocumentStatus(documentId, ProcessingStatus.PROCESSING);
      await this.updateQueueStatus(documentId, QueueStatus.PROCESSING);

      let result: ProcessingResult;

      switch (document.document_type) {
        case DocumentType.BANK_STATEMENT:
          result = await this.processBankStatement(document);
          break;
        case DocumentType.MPESA_STATEMENT:
          result = await this.processMpesaStatement(document);
          break;
        case DocumentType.SACCO_STATEMENT:
          result = await this.processSaccoStatement(document);
          break;
        case DocumentType.PAYSLIP:
          result = await this.processPayslip(document);
          break;
        case DocumentType.BUSINESS_REGISTRATION:
          result = await this.processBusinessRegistration(document);
          break;
        case DocumentType.TITLE_DEED:
          result = await this.processTitleDeed(document);
          break;
        default:
          result = { success: false, error: 'Unsupported document type' };
      }

      // Update document with extracted data
      if (result.success) {
        await this.updateDocumentWithResults(documentId, result.extractedData);
        await this.updateDocumentStatus(documentId, ProcessingStatus.COMPLETED);
        await this.updateQueueStatus(documentId, QueueStatus.COMPLETED);
      } else {
        await this.updateDocumentStatus(documentId, ProcessingStatus.FAILED);
        await this.updateQueueStatus(documentId, QueueStatus.FAILED, result.error);
      }

      return result;
    } catch (error) {
      this.logger.error(`Error processing document ${documentId}:`, error);
      await this.updateDocumentStatus(documentId, ProcessingStatus.FAILED);
      await this.updateQueueStatus(documentId, QueueStatus.FAILED, error.message);
      
      return { success: false, error: error.message };
    }
  }

  private async processBankStatement(document: FinancialDocuments): Promise<ProcessingResult> {
    const fileBuffer = fs.readFileSync(document.file_path);
    
    if (document.file_path.endsWith('.pdf')) {
      return this.processBankStatementPdf(fileBuffer, document);
    } else if (document.file_path.endsWith('.csv')) {
      return this.processBankStatementCsv(document.file_path, document);
    }

    return { success: false, error: 'Unsupported bank statement format' };
  }

  private async processBankStatementPdf(fileBuffer: Buffer, document: FinancialDocuments): Promise<ProcessingResult> {
    try {
      // TODO: Implement PDF parsing when pdf-parse is available
      // For now, return a placeholder result
      const extractedData = {
        totalTransactions: 0,
        dateRange: null,
        accountBalance: null,
        extractedText: "PDF processing not yet implemented",
        placeholder: true
      };

      return {
        success: true,
        extractedData,
        transactionsExtracted: 0
      };
    } catch (error) {
      return { success: false, error: `PDF processing failed: ${error.message}` };
    }
  }

  private async processBankStatementCsv(filePath: string, document: FinancialDocuments): Promise<ProcessingResult> {
    try {
      // TODO: Implement CSV parsing when csv-parser is available
      // For now, return a placeholder result
      const extractedData = {
        totalTransactions: 0,
        dateRange: null,
        csvHeaders: [],
        placeholder: true
      };

      return {
        success: true,
        extractedData,
        transactionsExtracted: 0
      };
    } catch (error) {
      return { success: false, error: `CSV processing failed: ${error.message}` };
    }
  }

  private async processMpesaStatement(document: FinancialDocuments): Promise<ProcessingResult> {
    try {
      // TODO: Implement M-Pesa statement parsing when pdf-parse is available
      const extractedData = {
        totalTransactions: 0,
        mpesaBalance: null,
        transactionTypes: [],
        placeholder: true
      };

      return {
        success: true,
        extractedData,
        transactionsExtracted: 0
      };
    } catch (error) {
      return { success: false, error: `M-Pesa processing failed: ${error.message}` };
    }
  }

  private async processSaccoStatement(document: FinancialDocuments): Promise<ProcessingResult> {
    // SACCO-specific processing logic
    return { success: true, extractedData: { type: 'sacco_statement' } };
  }

  private async processPayslip(document: FinancialDocuments): Promise<ProcessingResult> {
    // Payslip processing logic
    return { success: true, extractedData: { type: 'payslip' } };
  }

  private async processBusinessRegistration(document: FinancialDocuments): Promise<ProcessingResult> {
    // Business registration processing logic
    return { success: true, extractedData: { type: 'business_registration' } };
  }

  private async processTitleDeed(document: FinancialDocuments): Promise<ProcessingResult> {
    // Title deed processing logic
    return { success: true, extractedData: { type: 'title_deed' } };
  }

  private extractTransactionsFromText(text: string, sourceType: SourceType): any[] {
    // This is a simplified implementation
    // In production, you'd use more sophisticated pattern matching
    const transactions: any[] = [];
    const lines = text.split('\n');

    for (const line of lines) {
      // Look for transaction patterns (this is very basic)
      const transactionMatch = line.match(/(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+([\d,]+\.?\d*)/);
      if (transactionMatch) {
        const description = transactionMatch[2].trim();
        transactions.push({
          transaction_date: new Date(transactionMatch[1]),
          description: description,
          amount: parseFloat(transactionMatch[3].replace(/,/g, '')),
          source_type: sourceType,
          transaction_type: this.categorizeTransaction(description),
          category: 'General',
        });
      }
    }

    return transactions;
  }

  private extractMpesaTransactions(text: string): any[] {
    // M-Pesa specific transaction extraction
    const transactions: any[] = [];
    const lines = text.split('\n');

    for (const line of lines) {
      // M-Pesa transaction patterns
      if (line.includes('sent to') || line.includes('received from') || line.includes('Withdraw')) {
        // Extract M-Pesa transaction details
        const description = line.trim();
        transactions.push({
          transaction_date: new Date(),
          description: description,
          amount: this.extractAmountFromMpesaLine(line),
          source_type: SourceType.MPESA,
          transaction_type: this.categorizeMpesaTransaction(description),
          category: 'Mobile Money',
        });
      }
    }

    return transactions;
  }

  private mapCsvRowToTransaction(row: any, sourceType: SourceType): any {
    // Map CSV row to transaction format
    // This would need to be customized based on the CSV format
    const description = row.Description || row.description || row.Details || '';
    return {
      transaction_date: new Date(row.Date || row.date),
      description: description,
      amount: parseFloat(row.Amount || row.amount || '0'),
      source_type: sourceType,
      transaction_type: this.categorizeTransaction(description),
      category: row.Category || 'General',
    };
  }

  private categorizeTransaction(description: string): TransactionType {
    const desc = description.toLowerCase();
    
    if (desc.includes('salary') || desc.includes('pay') || desc.includes('income')) {
      return TransactionType.INCOME;
    } else if (desc.includes('withdrawal') || desc.includes('withdraw')) {
      return TransactionType.WITHDRAWAL;
    } else if (desc.includes('deposit')) {
      return TransactionType.DEPOSIT;
    } else if (desc.includes('transfer')) {
      return TransactionType.TRANSFER;
    } else if (desc.includes('payment') || desc.includes('bill')) {
      return TransactionType.PAYMENT;
    }
    
    return TransactionType.EXPENSE;
  }

  private categorizeMpesaTransaction(description: string): TransactionType {
    const desc = description.toLowerCase();
    
    if (desc.includes('received')) {
      return TransactionType.INCOME;
    } else if (desc.includes('sent') || desc.includes('pay')) {
      return TransactionType.PAYMENT;
    } else if (desc.includes('withdraw')) {
      return TransactionType.WITHDRAWAL;
    }
    
    return TransactionType.TRANSFER;
  }

  private async saveTransactions(transactions: any[], customerId: string): Promise<void> {
    for (const transaction of transactions) {
      const transactionEntity = new TransactionHistory();
      Object.assign(transactionEntity, transaction);
      transactionEntity.customer_id = customerId;
      
      await this.transactionHistoryRepository.save(transactionEntity);
    }
  }

  private getDateRange(transactions: any[]): { start: Date, end: Date } | null {
    if (transactions.length === 0) return null;
    
    const dates = transactions.map(t => new Date(t.transaction_date)).sort();
    return {
      start: dates[0],
      end: dates[dates.length - 1]
    };
  }

  private extractAccountBalance(text: string): number | null {
    const balanceMatch = text.match(/balance[:\s]+[\$\w]*\s*([\d,]+\.?\d*)/i);
    return balanceMatch ? parseFloat(balanceMatch[1].replace(/,/g, '')) : null;
  }

  private extractMpesaBalance(text: string): number | null {
    const balanceMatch = text.match(/balance[:\s]+Ksh\s*([\d,]+\.?\d*)/i);
    return balanceMatch ? parseFloat(balanceMatch[1].replace(/,/g, '')) : null;
  }

  private extractAmountFromMpesaLine(line: string): number {
    const amountMatch = line.match(/Ksh\s*([\d,]+\.?\d*)/);
    return amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : 0;
  }

  private getMpesaTransactionTypes(transactions: any[]): string[] {
    return [...new Set(transactions.map(t => t.transaction_type))];
  }

  private async updateDocumentStatus(documentId: number, status: ProcessingStatus): Promise<void> {
    await this.financialDocumentsRepository.update(documentId, { 
      processing_status: status,
      updated_at: new Date()
    });
  }

  private async updateQueueStatus(documentId: number, status: QueueStatus, errorMessage?: string): Promise<void> {
    const updateData: any = { status };
    
    if (status === QueueStatus.PROCESSING) {
      updateData.started_at = new Date();
    } else if (status === QueueStatus.COMPLETED || status === QueueStatus.FAILED) {
      updateData.completed_at = new Date();
    }
    
    if (errorMessage) {
      updateData.error_message = errorMessage;
    }

    await this.processingQueueRepository.update({ document_id: documentId }, updateData);
  }

  private async updateDocumentWithResults(documentId: number, extractedData: any): Promise<void> {
    await this.financialDocumentsRepository.update(documentId, { 
      extracted_data: extractedData,
      updated_at: new Date()
    });
  }

  async processQueuedDocuments(): Promise<void> {
    const queuedItems = await this.processingQueueRepository.find({
      where: { status: QueueStatus.QUEUED },
      order: { priority: 'ASC', created_at: 'ASC' },
      take: 10 // Process 10 items at a time
    });

    for (const item of queuedItems) {
      try {
        await this.processDocument(item.document_id);
      } catch (error) {
        this.logger.error(`Failed to process document ${item.document_id}:`, error);
        await this.updateQueueStatus(item.document_id, QueueStatus.FAILED, error.message);
      }
    }
  }
}
