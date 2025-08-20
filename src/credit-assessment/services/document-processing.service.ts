import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as pdfParse from 'pdf-parse';
import { AiService } from '../../ai/ai.service';
import { DataExtractionService } from '../../document-processing/services/data-extraction.service';
// import * as csv from 'csv-parser';
import { FinancialDocuments, ProcessingStatus, DocumentType } from '../../entities/financial-documents.entity';
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
  private readonly BATCH_SIZE = 3; // Process 3 documents at a time
  private readonly BATCH_DELAY = 2000; // 2 seconds between batches
  private readonly MAX_CHUNK_SIZE = 4000; // Characters per chunk
  private readonly CHUNK_OVERLAP = 200;   // Overlap between chunks to maintain context


  constructor(
    @InjectRepository(FinancialDocuments)
    private readonly financialDocumentsRepository: Repository<FinancialDocuments>,
    @InjectRepository(DocumentProcessingQueue)
    private readonly processingQueueRepository: Repository<DocumentProcessingQueue>,
    @InjectRepository(TransactionHistory)
    private readonly transactionHistoryRepository: Repository<TransactionHistory>,
    private readonly dataExtractionService: DataExtractionService,
    private readonly aiService: AiService,
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
          result = await this.processDocumentWithAI(document);
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
  async processBatch(documents: FinancialDocuments[]): Promise<ProcessingResult[]> {
    const results: ProcessingResult[] = [];
    
    for (let i = 0; i < documents.length; i += this.BATCH_SIZE) {
      const batch = documents.slice(i, i + this.BATCH_SIZE);
      
      // Process batch in parallel
      const batchPromises = batch.map(doc => this.processDocumentWithAI(doc));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Wait before processing next batch
      if (i + this.BATCH_SIZE < documents.length) {
        await new Promise(resolve => setTimeout(resolve, this.BATCH_DELAY));
      }
    }

    return results;
  }

// Add this helper method for chunking text
private chunkText(text: string): string[] {
  const chunks: string[] = [];
  let startIndex = 0;

  while (startIndex < text.length) {
    let endIndex = startIndex + this.MAX_CHUNK_SIZE;
    
    // If this isn't the last chunk, try to find a natural break point
    if (endIndex < text.length) {
      // Look for natural break points (newline, period, etc.) within the overlap window
      const searchWindow = text.slice(endIndex - this.CHUNK_OVERLAP, endIndex);
      const lastBreak = searchWindow.lastIndexOf('\n');
      
      if (lastBreak !== -1) {
        endIndex = endIndex - this.CHUNK_OVERLAP + lastBreak;
      } else {
        // If no newline, try to break at a period or space
        const periodBreak = searchWindow.lastIndexOf('.');
        const spaceBreak = searchWindow.lastIndexOf(' ');
        const breakPoint = Math.max(periodBreak, spaceBreak);
        
        if (breakPoint !== -1) {
          endIndex = endIndex - this.CHUNK_OVERLAP + breakPoint + 1;
        }
      }
    }

    chunks.push(text.slice(startIndex, endIndex).trim());
    startIndex = endIndex;
  }

  return chunks;
}

// Add this method to merge AI results from multiple chunks
private mergeAIResults(results: any[]): any {
  const mergedTransactions = results.reduce((acc, result) => {
    if (result?.transactions?.length) {
      acc.push(...result.transactions);
    }
    return acc;
  }, []);

  // Remove duplicate transactions based on date and amount
  const uniqueTransactions = Array.from(new Map(
    mergedTransactions.map(item => [
      `${item.transaction_date}_${item.amount}_${item.description}`,
      item
    ])
  ).values());

  // Merge metadata
  const mergedMetadata = results.reduce((acc, result) => {
    if (result?.metadata) {
      return { ...acc, ...result.metadata };
    }
    return acc;
  }, {});

  return {
    success: true,
    transactions: uniqueTransactions,
    metadata: mergedMetadata
  };
}

// Refactored processDocumentWithAI function
private async processDocumentWithAI(document: FinancialDocuments): Promise<ProcessingResult> {
  try {
    if (!fs.existsSync(document.file_path)) {
      return { success: false, error: 'Document file not found' };
    }

    const fileBuffer = fs.readFileSync(document.file_path);
    let textContent: string;

    // Extract text based on file type
    if (document.file_path.endsWith('.pdf')) {
      try {
        const parsed = await pdfParse(fileBuffer, {
          max: 0,
          pagerender: null,
          version: 'v2.0.550'
        });
        
        if (parsed.text && parsed.text.trim().length > 0) {
          textContent = parsed.text;
        } else {
          const tempPath = await this.writeTempPdf(document.document_id, fileBuffer);
          try {
            const extracted = await this.dataExtractionService.extractData(
              tempPath,
              document.document_type,
              { method: 'ocr', enhanceImage: false }
            );
            
            if (extracted && extracted.text) {
              textContent = extracted.text;
            } else {
              const parsedFallback = await pdfParse(fileBuffer, {
                max: 0,
                pagerender: null,
                version: 'v2.0.550'
              });
              textContent = parsedFallback.text || '';
            }
          } catch (ocrError) {
            this.logger.error(`OCR failed: ${ocrError.message}`);
            textContent = fileBuffer.toString('utf-8');
          }
        }
      } catch (error) {
        this.logger.error(`PDF parsing error: ${error.message}`);
        textContent = fileBuffer.toString('utf-8');
      }
    } else if (document.file_path.endsWith('.csv')) {
      textContent = fileBuffer.toString();
    } else {
      return { success: false, error: 'Unsupported file format' };
    }

    if (!textContent || textContent.trim().length === 0) {
      return { success: false, error: 'No text content could be extracted from document' };
    }

    // Split text into manageable chunks
    const chunks = this.chunkText(textContent);
    this.logger.log(`Processing document in ${chunks.length} chunks`);

    // Process each chunk with delay to respect rate limits
    const chunkResults = [];
    for (let i = 0; i < chunks.length; i++) {
      try {
        // Add delay between chunks to respect rate limits
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        const aiResult = await this.aiService.processWithOllama(chunks[i], {
          documentType: document.document_type,
          customerId: document.customer_id,
          documentId: document.document_id,
          chunkIndex: i,
          totalChunks: chunks.length
        });

        if (aiResult.success) {
          chunkResults.push(aiResult);
        } else {
          this.logger.warn(`Failed to process chunk ${i + 1}/${chunks.length}: ${aiResult.error}`);
        }
      } catch (error) {
        this.logger.error(`Error processing chunk ${i + 1}/${chunks.length}:`, error);
        // Continue with other chunks even if one fails
      }
    }

    if (chunkResults.length === 0) {
      return {
        success: false,
        error: 'Failed to process any document chunks'
      };
    }

    // Merge results from all chunks
    const mergedResult = this.mergeAIResults(chunkResults);

    // Validate and save transactions
    const validTransactions = mergedResult.transactions.filter(t => 
      this.isValidTransaction(t)
    );

    if (validTransactions.length === 0) {
      return {
        success: false,
        error: 'No valid transactions could be extracted'
      };
    }

    // Save valid transactions
    await this.saveTransactions(validTransactions, document.customer_id);
    this.logger.log('Valid transactions saved', validTransactions);

    return {
      success: true,
      extractedData: {
        transactions: validTransactions,
        dateRange: this.getDateRange(validTransactions),
        transactionTypes: validTransactions.map(t => t.transaction_type),
        metadata: mergedResult.metadata,
        processingStats: {
          totalChunks: chunks.length,
          successfulChunks: chunkResults.length,
          totalTransactions: validTransactions.length
        }
      }
    };

  } catch (error) {
    this.logger.error(`AI processing error for document ${document.document_id}:`, error);
    return {
      success: false,
      error: error.message || 'Failed to process document with AI'
    };
  }
}
  // private async processDocumentWithAI(document: FinancialDocuments): Promise<ProcessingResult> {
  //   try {
  //     if (!fs.existsSync(document.file_path)) {
  //       return { success: false, error: 'Document file not found' };
  //     }

  //     const fileBuffer = fs.readFileSync(document.file_path);
  //     let textContent: string;

  //     // Extract text based on file type
  //     if (document.file_path.endsWith('.pdf')) {
  //       try {
  //         // Try pdf-parse first for text-based PDFs
  //         const parsed = await pdfParse(fileBuffer, {
  //           max: 0,
  //           pagerender: null,
  //           version: 'v2.0.550'
  //         });
          
  //         if (parsed.text && parsed.text.trim().length > 0) {
  //           textContent = parsed.text;
  //         } else {
  //           // Fallback to OCR only if no text found
  //           const tempPath = await this.writeTempPdf(document.document_id, fileBuffer);
  //           try {
  //             const extracted = await this.dataExtractionService.extractData(
  //               tempPath,
  //               document.document_type,
  //               { method: 'ocr', enhanceImage: false }
  //             );
              
  //             if (extracted && extracted.text) {
  //               textContent = extracted.text;
  //             } else {
  //               // Fallback to pdf-parse with error handling
  //               const parsed = await pdfParse(fileBuffer, {
  //                 max: 0, // No page limit
  //                 pagerender: null, // Skip rendering
  //                 version: 'v2.0.550'
  //               });
  //               textContent = parsed.text || '';
  //             }
  //           } catch (pdfError) {
  //             this.logger.error(`PDF processing error: ${pdfError.message}`);
  //             // Try raw buffer as last resort
  //             textContent = fileBuffer.toString('utf-8');
  //           }
  //         }
  //       } catch (error) {
  //         this.logger.error(`PDF parsing error: ${error.message}`);
  //         textContent = fileBuffer.toString('utf-8');
  //       }
  //     } else if (document.file_path.endsWith('.csv')) {
  //       textContent = fileBuffer.toString();
  //     } else {
  //       return { success: false, error: 'Unsupported file format' };
  //     }

  //     if (!textContent || textContent.trim().length === 0) {
  //       return { success: false, error: 'No text content could be extracted from document' };
  //     }
  //     this.logger.fatal('The text content is processed' + textContent);

  //     // Process with AI service
  //     const aiResult = await this.aiService.processDocumentText(textContent, {
  //       documentType: document.document_type,
  //       customerId: document.customer_id,
  //       documentId: document.document_id
  //     });

  //     if (!aiResult.success) {
  //       return {
  //         success: false,
  //         error: aiResult.error || 'AI processing failed'
  //       };
  //     }

  //     // Extract and validate transactions
  //     const transactions = aiResult.transactions || [];
      
  //     if (transactions.length === 0) {
  //       this.logger.warn(`No transactions extracted from document ${document.document_id} by AI`);
  //       return {
  //         success: false, 
  //         error: 'No valid transactions could be extracted'
  //       };
  //     }

  //     // Validate extracted transactions
  //     const validTransactions = transactions.filter(t => 
  //       this.isValidTransaction(t)
  //     );

  //     if (validTransactions.length === 0) {
  //       return {
  //         success: false,
  //         error: 'Extracted transactions failed validation'
  //       };
  //     }

  //     // Save valid transactions
  //     await this.saveTransactions(validTransactions, document.customer_id);

  //     return {
  //       success: true,
  //       extractedData: {
  //         transactions: validTransactions,
  //         dateRange: this.getDateRange(validTransactions),
  //         transactionTypes: validTransactions.map(t => t.transaction_type),
  //         metadata: aiResult.metadata
  //       }
  //     };

  //   } catch (error) {
  //     this.logger.error(`AI processing error for document ${document.document_id}:`, error);
  //     return {
  //       success: false,
  //       error: error.message || 'Failed to process document with AI'
  //     };
  //   }
  // }
  
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
      // Prefer OCR-based extraction using Tesseract via DataExtractionService
      const tempPath = await this.writeTempPdf(document.document_id, fileBuffer);
      const extracted = await this.dataExtractionService.extractData(
        tempPath,
        DocumentType.BANK_STATEMENT,
        { method: 'ocr', enhanceImage: true, extractEntities: true }
      );
      const text = extracted.text || '';

      // Fallback: if OCR returns very low quality, try pdf-parse text
      let parsed: any = undefined;
      if (this.calculateTextQualityScore(text) < 20) {
        parsed = await pdfParse(fileBuffer);
      }

      // Extract transactions from text
      const transactions = this.extractTransactionsFromText(text, SourceType.BANK);
      
      if (transactions.length === 0) {
        this.logger.warn(`No transactions extracted from document ${document.document_id}`);
        return {
          success: false,
          error: 'No valid transactions could be extracted from the document'
        };
      }

      // Validate extracted transactions
      const validTransactions = transactions.filter(t => 
        this.isValidTransaction(t)
      );

      if (validTransactions.length === 0) {
        return {
          success: false,
          error: 'Extracted transactions failed validation'
        };
      }

      // Persist valid transactions
      await this.saveTransactions(validTransactions, document.customer_id);

      // Enhanced data extraction with validation
      const dateRange = this.getDateRange(validTransactions);
      const accountBalance = this.extractAccountBalance(text);

      if (!dateRange || !accountBalance) {
        this.logger.warn(`Missing critical data in document ${document.document_id}`);
      }

      const extractedData = {
        totalTransactions: validTransactions.length,
        dateRange,
        accountBalance,
        pageCount: parsed?.numpages ?? undefined,
        parsingMethod: 'ocr',
        textQualityScore: this.calculateTextQualityScore(text),
        placeholder: false
      };

      return {
        success: true,
        extractedData,
        transactionsExtracted: validTransactions.length
      };

    } catch (error) {
      this.logger.error(`PDF processing failed for document ${document.document_id}:`, error);
      return { 
        success: false, 
        error: `PDF processing failed: ${error instanceof Error ? error.message : String(error)}` 
      };
    }
  }

  // --- Helper methods introduced by enhanced PDF parsing ---
  private isValidBankStatementText(text: string): boolean {
    if (!text) return false;
    const normalized = text.toLowerCase();
    const hasKeywords = ['statement', 'account', 'balance']
      .some(k => normalized.includes(k));
    return text.length >= 50 && hasKeywords;
  }

  private formatPdf2JsonText(pdfData: any): string {
    try {
      if (!pdfData || !Array.isArray(pdfData.Pages)) return '';
      const parts: string[] = [];
      for (const page of pdfData.Pages) {
        if (!Array.isArray(page.Texts)) continue;
        for (const t of page.Texts) {
          if (Array.isArray(t.R)) {
            for (const r of t.R) {
              if (r && r.T) parts.push(decodeURIComponent(r.T));
            }
          } else if (t && t.T) {
            parts.push(decodeURIComponent(t.T));
          }
        }
        parts.push('\n');
      }
      return parts.join(' ').replace(/\s+/g, ' ').trim();
    } catch {
      return '';
    }
  }

  private isValidTransaction(t: any): boolean {
    if (!t) return false;
    const hasDesc = typeof t.description === 'string' && t.description.trim().length > 0;
    const hasAmount = typeof t.amount === 'number' && isFinite(t.amount);
    const date = new Date(t.transaction_date);
    const hasDate = !isNaN(date.getTime());
    return hasDesc && hasAmount && hasDate;
  }

  private calculateTextQualityScore(text: string): number {
    if (!text) return 0;
    const total = text.length;
    const alphaNum = (text.match(/[A-Za-z0-9]/g) || []).length;
    const digits = (text.match(/\d/g) || []).length;
    const ratio = alphaNum / total;
    const score = Math.max(0, Math.min(1, ratio * 0.7 + Math.min(digits / 50, 0.3)));
    return Math.round(score * 100);
  }

  private async writeTempPdf(documentId: number, buffer: Buffer): Promise<string> {
    const dir = './uploads/tmp';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const path = `${dir}/doc-${documentId}.pdf`;
    fs.writeFileSync(path, buffer);
    return path;
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

