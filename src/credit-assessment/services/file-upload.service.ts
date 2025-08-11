import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { FinancialDocuments, DocumentType, ProcessingStatus } from '../../entities/financial-documents.entity';
import { DocumentProcessingQueue, QueueStatus } from '../../entities/document-processing-queue.entity';

export interface UploadedFileMetadata {
  originalName: string;
  filename: string;
  path: string;
  size: number;
  mimetype: string;
}

@Injectable()
export class FileUploadService {
  constructor(
    @InjectRepository(FinancialDocuments)
    private readonly financialDocumentsRepository: Repository<FinancialDocuments>,
    @InjectRepository(DocumentProcessingQueue)
    private readonly processingQueueRepository: Repository<DocumentProcessingQueue>,
  ) {}

  async uploadDocument(
    customerId: string,
    documentType: DocumentType,
    file: UploadedFileMetadata,
    additionalData?: any
  ): Promise<FinancialDocuments> {
    // Validate file
    this.validateFile(file);

    // Create financial document record
    const financialDocument = new FinancialDocuments();
    financialDocument.customer_id = customerId;
    financialDocument.document_type = documentType;
    financialDocument.file_path = file.path;
    financialDocument.processing_status = ProcessingStatus.PENDING;
    financialDocument.document_data = {
      originalName: file.originalName,
      filename: file.filename,
      size: file.size,
      mimetype: file.mimetype,
      uploadedAt: new Date(),
      ...additionalData
    };

    const savedDocument = await this.financialDocumentsRepository.save(financialDocument);

    // Add to processing queue
    await this.addToProcessingQueue(savedDocument);

    return savedDocument;
  }

  private validateFile(file: UploadedFileMetadata): void {
    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new BadRequestException('File size exceeds 10MB limit');
    }

    // Check file type
    const allowedTypes = [
      'application/pdf',
      'text/csv',
      'image/jpeg',
      'image/png',
      'image/jpg',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type. Only PDF, CSV, and image files are allowed.');
    }

    // Check if file exists
    if (!fs.existsSync(file.path)) {
      throw new BadRequestException('File not found after upload');
    }
  }

  private async addToProcessingQueue(document: FinancialDocuments): Promise<void> {
    const queueItem = new DocumentProcessingQueue();
    queueItem.document_id = document.document_id;
    queueItem.customer_id = document.customer_id;
    queueItem.priority = this.getPriorityByDocumentType(document.document_type);
    queueItem.status = QueueStatus.QUEUED;

    await this.processingQueueRepository.save(queueItem);
  }

  private getPriorityByDocumentType(documentType: DocumentType): number {
    // Higher priority (lower number) for more important documents
    const priorityMap = {
      [DocumentType.BANK_STATEMENT]: 1,
      [DocumentType.MPESA_STATEMENT]: 2,
      [DocumentType.SACCO_STATEMENT]: 3,
      [DocumentType.PAYSLIP]: 4,
      [DocumentType.BUSINESS_REGISTRATION]: 5,
      [DocumentType.TITLE_DEED]: 6,
    };

    return priorityMap[documentType] || 5;
  }

  async getDocumentsByCustomer(customerId: string): Promise<FinancialDocuments[]> {
    return this.financialDocumentsRepository.find({
      where: { customer_id: customerId },
      order: { upload_date: 'DESC' }
    });
  }

  async deleteDocument(documentId: number): Promise<void> {
    const document = await this.financialDocumentsRepository.findOne({
      where: { document_id: documentId }
    });

    if (!document) {
      throw new BadRequestException('Document not found');
    }

    // Delete physical file
    if (document.file_path && fs.existsSync(document.file_path)) {
      fs.unlinkSync(document.file_path);
    }

    // Remove from database
    await this.financialDocumentsRepository.remove(document);

    // Remove from processing queue if exists
    await this.processingQueueRepository.delete({ document_id: documentId });
  }

  async ensureUploadDirectory(): Promise<void> {
    const uploadDir = './uploads/documents';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
  }
}
