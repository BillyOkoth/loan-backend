import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

// Services
import { FileUploadService } from './file-upload.service';
import { DocumentProcessingService } from './document-processing.service';
import { CreditScoringService, CreditScoreResult } from './credit-scoring.service';

// Entities
import { FinancialDocuments, DocumentType } from '../../entities/financial-documents.entity';
import { CreditAssessments } from '../../entities/credit-assessments.entity';
import { KenyanCreditFactors } from '../../entities/kenyan-credit-factors.entity';
import { CustomerReferences } from '../../entities/customer-references.entity';
import { Client } from '../../entities/client.entity';

export interface UploadDocumentDto {
  customerId: string;
  documentType: DocumentType;
  additionalData?: any;
}

export interface AssessmentSummary {
  customerId: string;
  creditScore: number;
  riskLevel: string;
  confidenceLevel: number;
  lastAssessmentDate: Date;
  documentsCount: number;
  transactionsCount: number;
  recommendations: string[];
}

@Injectable()
export class CreditAssessmentService {
  private readonly logger = new Logger(CreditAssessmentService.name);

  constructor(
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
    @InjectRepository(FinancialDocuments)
    private readonly financialDocumentsRepository: Repository<FinancialDocuments>,
    @InjectRepository(CreditAssessments)
    private readonly creditAssessmentsRepository: Repository<CreditAssessments>,
    @InjectRepository(KenyanCreditFactors)
    private readonly kenyanFactorsRepository: Repository<KenyanCreditFactors>,
    @InjectRepository(CustomerReferences)
    private readonly customerReferencesRepository: Repository<CustomerReferences>,
    private readonly fileUploadService: FileUploadService,
    private readonly documentProcessingService: DocumentProcessingService,
    private readonly creditScoringService: CreditScoringService,
  ) {
    // Ensure upload directory exists
    this.fileUploadService.ensureUploadDirectory();
  }

  async uploadDocument(uploadData: UploadDocumentDto, file: any): Promise<FinancialDocuments> {
    // Validate customer exists
    await this.validateCustomerExists(uploadData.customerId);

    // Upload document
    const fileMetadata = {
      originalName: file.originalname,
      filename: file.filename,
      path: file.path,
      size: file.size,
      mimetype: file.mimetype,
    };

    const document = await this.fileUploadService.uploadDocument(
      uploadData.customerId,
      uploadData.documentType,
      fileMetadata,
      uploadData.additionalData
    );

    this.logger.log(`Document uploaded for customer ${uploadData.customerId}: ${document.document_id}`);

    // Trigger processing (async)
    this.processDocumentAsync(document.document_id);

    return document;
  }

  async performCreditAssessment(customerId: string): Promise<CreditScoreResult> {
    // Validate customer exists
    await this.validateCustomerExists(customerId);

    this.logger.log(`Starting credit assessment for customer: ${customerId}`);

    try {
      // Calculate credit score
      const result = await this.creditScoringService.calculateCreditScore(customerId);

      this.logger.log(`Credit assessment completed for customer ${customerId}: Score ${result.creditScore}`);

      return result;
    } catch (error) {
      this.logger.error(`Error performing credit assessment for customer ${customerId}:`, error);
      throw error;
    }
  }

  async getCreditScore(customerId: string): Promise<CreditAssessments | null> {
    const latestAssessment = await this.creditAssessmentsRepository.findOne({
      where: { customer_id: customerId },
      order: { assessment_date: 'DESC' }
    });

    return latestAssessment;
  }

  async getCreditHistory(customerId: string): Promise<CreditAssessments[]> {
    return this.creditAssessmentsRepository.find({
      where: { customer_id: customerId },
      order: { assessment_date: 'DESC' }
    });
  }

  async getCreditFactors(customerId: string): Promise<KenyanCreditFactors | null> {
    return this.kenyanFactorsRepository.findOne({
      where: { customer_id: customerId }
    });
  }

  async getAssessmentSummary(customerId: string): Promise<AssessmentSummary> {
    // Validate customer exists
    await this.validateCustomerExists(customerId);

    // Get latest assessment
    const latestAssessment = await this.getCreditScore(customerId);
    
    // Get documents count
    const documentsCount = await this.financialDocumentsRepository.count({
      where: { customer_id: customerId }
    });

    // Get transactions count (from document processing)
    const documents = await this.financialDocumentsRepository.find({
      where: { customer_id: customerId }
    });

    let transactionsCount = 0;
    for (const doc of documents) {
      if (doc.extracted_data?.totalTransactions) {
        transactionsCount += doc.extracted_data.totalTransactions;
      }
    }

    return {
      customerId,
      creditScore: latestAssessment?.credit_score || 0,
      riskLevel: latestAssessment?.risk_level || 'unknown',
      confidenceLevel: latestAssessment?.confidence_level || 0,
      lastAssessmentDate: latestAssessment?.assessment_date || null,
      documentsCount,
      transactionsCount,
      recommendations: latestAssessment?.recommendations || []
    };
  }

  async getRiskAnalysis(customerId: string): Promise<any> {
    const assessment = await this.getCreditScore(customerId);
    const factors = await this.getCreditFactors(customerId);

    if (!assessment) {
      throw new NotFoundException('No credit assessment found for this customer');
    }

    return {
      customerId,
      riskLevel: assessment.risk_level,
      creditScore: assessment.credit_score,
      riskIndicators: assessment.risk_indicators || [],
      mitigatingFactors: this.identifyMitigatingFactors(factors),
      riskScore: this.calculateRiskScore(assessment.credit_score),
      recommendations: assessment.recommendations || []
    };
  }

  async addCustomerReference(customerId: string, referenceData: any): Promise<CustomerReferences> {
    // Validate customer exists
    await this.validateCustomerExists(customerId);

    const reference = new CustomerReferences();
    Object.assign(reference, referenceData);
    reference.customer_id = customerId;

    const savedReference = await this.customerReferencesRepository.save(reference);

    this.logger.log(`Reference added for customer ${customerId}: ${savedReference.reference_id}`);

    return savedReference;
  }

  async getCustomerReferences(customerId: string): Promise<CustomerReferences[]> {
    return this.customerReferencesRepository.find({
      where: { customer_id: customerId },
      order: { created_at: 'DESC' }
    });
  }

  async updateKenyanFactors(customerId: string, factorsData: Partial<KenyanCreditFactors>): Promise<KenyanCreditFactors> {
    // Validate customer exists
    await this.validateCustomerExists(customerId);

    let factors = await this.kenyanFactorsRepository.findOne({
      where: { customer_id: customerId }
    });

    if (!factors) {
      factors = new KenyanCreditFactors();
      factors.customer_id = customerId;
    }

    Object.assign(factors, factorsData);
    factors.last_updated = new Date();

    const savedFactors = await this.kenyanFactorsRepository.save(factors);

    this.logger.log(`Kenyan factors updated for customer ${customerId}`);

    return savedFactors;
  }

  async getCustomerDocuments(customerId: string): Promise<FinancialDocuments[]> {
    return this.fileUploadService.getDocumentsByCustomer(customerId);
  }

  async deleteDocument(documentId: number): Promise<void> {
    await this.fileUploadService.deleteDocument(documentId);
    this.logger.log(`Document deleted: ${documentId}`);
  }

  // Background processing methods
  // Note: Cron jobs temporarily disabled for Phase 1
  // TODO: Re-enable in Phase 2 when @nestjs/schedule is properly configured
  
  async processQueuedDocuments(): Promise<void> {
    this.logger.log('Processing queued documents...');
    await this.documentProcessingService.processQueuedDocuments();
  }

  async performScheduledAssessments(): Promise<void> {
    this.logger.log('Performing scheduled credit assessments...');
    
    // Find customers who need assessment updates
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30); // 30 days ago

    const customersNeedingAssessment = await this.creditAssessmentsRepository
      .createQueryBuilder('assessment')
      .select('DISTINCT assessment.customer_id')
      .where('assessment.assessment_date < :cutoffDate', { cutoffDate })
      .orWhere('assessment.customer_id IS NULL')
      .getRawMany();

    for (const customer of customersNeedingAssessment) {
      try {
        await this.performCreditAssessment(customer.customer_id);
      } catch (error) {
        this.logger.error(`Failed scheduled assessment for customer ${customer.customer_id}:`, error);
      }
    }
  }

  // Private helper methods

  private async validateCustomerExists(customerId: string): Promise<void> {
    const customer = await this.clientRepository.findOne({
      where: { customer_id: customerId }
    });
    

    if (!customer) {
      throw new NotFoundException(`Customer with ID ${customerId} not found`);
    }
  }

  private async processDocumentAsync(documentId: number): Promise<void> {
    // Process document in background (non-blocking)
    setTimeout(async () => {
      try {
        await this.documentProcessingService.processDocument(documentId);
        this.logger.log(`Document processed successfully: ${documentId}`);
      } catch (error) {
        this.logger.error(`Error processing document ${documentId}:`, error);
      }
    }, 1000); // 1 second delay to ensure transaction completion
  }

  private identifyMitigatingFactors(factors: KenyanCreditFactors): string[] {
    const mitigatingFactors: string[] = [];

    if (factors?.sacco_membership_duration_months > 24) {
      mitigatingFactors.push('Long-term SACCO membership');
    }

    if (factors?.land_ownership_value > 0) {
      mitigatingFactors.push('Property ownership');
    }

    if (factors?.family_financial_support_available) {
      mitigatingFactors.push('Family financial support network');
    }

    if (factors?.employment_duration_months > 36) {
      mitigatingFactors.push('Stable long-term employment');
    }

    if (factors?.business_registration_status === 'registered') {
      mitigatingFactors.push('Registered business ownership');
    }

    return mitigatingFactors;
  }

  private calculateRiskScore(creditScore: number): number {
    // Convert credit score (300-850) to risk score (1-100, higher = more risk)
    return Math.round(100 - ((creditScore - 300) / 550) * 100);
  }

  async getSystemStats(): Promise<any> {
    const totalAssessments = await this.creditAssessmentsRepository.count();
    const totalDocuments = await this.financialDocumentsRepository.count();
    const totalCustomers = await this.clientRepository.count();

    const riskDistribution = await this.creditAssessmentsRepository
      .createQueryBuilder('assessment')
      .select('assessment.risk_level, COUNT(*) as count')
      .groupBy('assessment.risk_level')
      .getRawMany();

    const avgCreditScore = await this.creditAssessmentsRepository
      .createQueryBuilder('assessment')
      .select('AVG(assessment.credit_score)', 'avg')
      .getRawOne();

    return {
      totalAssessments,
      totalDocuments,
      totalCustomers,
      riskDistribution,
      avgCreditScore: Math.round(avgCreditScore?.avg || 0)
    };
  }
}
