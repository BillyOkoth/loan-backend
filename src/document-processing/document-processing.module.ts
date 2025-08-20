import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransactionHistory } from '../entities/transaction-history.entity';
import { FinancialDocuments } from '../entities/financial-documents.entity';
import { DocumentProcessingQueue } from '../entities/document-processing-queue.entity';

// Import parsers
import { PdfParser } from './parsers/pdf.parser';
import { CsvParser } from './parsers/csv.parser';
import { MPesaParser } from './parsers/mpesa.parser';
import { SaccoParser } from './parsers/sacco.parser';

// Import services
import { TransactionCategorizationService } from './services/transaction-categorization.service';
import { DataExtractionService } from './services/data-extraction.service';
import { ErrorHandlingService } from './services/error-handling.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TransactionHistory,
      FinancialDocuments,
      DocumentProcessingQueue
    ])
  ],
  providers: [
    // Parsers
    PdfParser,
    CsvParser,
    MPesaParser,
    SaccoParser,

    // Services
    TransactionCategorizationService,
    DataExtractionService,
    ErrorHandlingService
  ],
  exports: [
    // Parsers
    PdfParser,
    CsvParser,
    MPesaParser,
    SaccoParser,

    // Services
    TransactionCategorizationService,
    DataExtractionService,
    ErrorHandlingService
  ]
})
export class DocumentProcessingModule {}
