import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as uuid from 'uuid';

// Entities
import { FinancialDocuments } from '../entities/financial-documents.entity';
import { TransactionHistory } from '../entities/transaction-history.entity';
import { KenyanCreditFactors } from '../entities/kenyan-credit-factors.entity';
import { CreditAssessments } from '../entities/credit-assessments.entity';
import { CustomerReferences } from '../entities/customer-references.entity';
import { DocumentProcessingQueue } from '../entities/document-processing-queue.entity';
import { Client } from '../entities/client.entity';

// Services
import { CreditAssessmentService } from './services/credit-assessment.service';
import { DocumentProcessingService } from './services/document-processing.service';
import { FileUploadService } from './services/file-upload.service';
import { CreditScoringService } from './services/credit-scoring.service';
import { AiService } from '../ai/ai.service';
import { DocumentProcessingModule } from '../document-processing/document-processing.module';

// Controllers
import { CreditAssessmentController } from './controllers/credit-assessment.controller';

@Module({
  imports: [
    DocumentProcessingModule,
    TypeOrmModule.forFeature([
      FinancialDocuments,
      TransactionHistory,
      KenyanCreditFactors,
      CreditAssessments,
      CustomerReferences,
      DocumentProcessingQueue,
      Client,
    ]),
    MulterModule.register({
      storage: diskStorage({
        destination: './uploads/documents',
        filename: (req, file, callback) => {
          const uniqueName = `${uuid.v4()}${extname(file.originalname)}`;
          callback(null, uniqueName);
        },
      }),
      fileFilter: (req, file, callback) => {
        // Allow PDF, CSV, JPG, PNG files
        const allowedTypes = [
          'application/pdf',
          'text/csv',
          'image/jpeg',
          'image/png',
          'image/jpg',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ];
        
        if (allowedTypes.includes(file.mimetype)) {
          callback(null, true);
        } else {
          callback(new Error('Invalid file type. Only PDF, CSV, and image files are allowed.'), false);
        }
      },
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
      },
    }),
  ],
  controllers: [CreditAssessmentController],
  providers: [
    CreditAssessmentService,
    DocumentProcessingService,
    FileUploadService,
    CreditScoringService,
    AiService,
  ],
  exports: [
    CreditAssessmentService,
    DocumentProcessingService,
    FileUploadService,
    CreditScoringService,
  ],
})
export class CreditAssessmentModule {}
