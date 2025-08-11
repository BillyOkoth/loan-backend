import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KenyanCreditFactors, RiskLevel } from '../../entities/kenyan-credit-factors.entity';
import { CreditAssessments, AssessmentMethod } from '../../entities/credit-assessments.entity';
import { TransactionHistory, SourceType } from '../../entities/transaction-history.entity';
import { FinancialDocuments, DocumentType } from '../../entities/financial-documents.entity';

// Kenyan-specific credit scoring weights
const KENYAN_CREDIT_WEIGHTS = {
  paymentHistory: 0.25,        // Traditional payment history
  mpesaConsistency: 0.20,      // M-Pesa usage patterns
  saccoMembership: 0.15,       // SACCO participation
  incomeStability: 0.15,       // Employment/business stability
  communityTrust: 0.10,        // Community references
  assetOwnership: 0.10,        // Land/property ownership
  digitalAdoption: 0.05        // Digital payment adoption
};

export interface CreditScoreResult {
  creditScore: number;
  riskLevel: RiskLevel;
  confidenceLevel: number;
  factors: any;
  recommendations: string[];
  riskIndicators: string[];
}

@Injectable()
export class CreditScoringService {
  private readonly logger = new Logger(CreditScoringService.name);

  constructor(
    @InjectRepository(KenyanCreditFactors)
    private readonly kenyanFactorsRepository: Repository<KenyanCreditFactors>,
    @InjectRepository(CreditAssessments)
    private readonly creditAssessmentsRepository: Repository<CreditAssessments>,
    @InjectRepository(TransactionHistory)
    private readonly transactionHistoryRepository: Repository<TransactionHistory>,
    @InjectRepository(FinancialDocuments)
    private readonly financialDocumentsRepository: Repository<FinancialDocuments>,
  ) {}

  async calculateCreditScore(customerId: string): Promise<CreditScoreResult> {
    try {
      // Gather all relevant data
      const kenyanFactors = await this.getOrCreateKenyanFactors(customerId);
      const transactions = await this.getCustomerTransactions(customerId);
      const documents = await this.getCustomerDocuments(customerId);

      // Calculate individual factor scores
      const paymentHistoryScore = await this.calculatePaymentHistoryScore(transactions);
      const mpesaScore = await this.calculateMpesaScore(transactions, kenyanFactors);
      const saccoScore = await this.calculateSaccoScore(kenyanFactors);
      const incomeStabilityScore = await this.calculateIncomeStabilityScore(transactions, kenyanFactors);
      const communityScore = await this.calculateCommunityTrustScore(kenyanFactors);
      const assetScore = await this.calculateAssetOwnershipScore(kenyanFactors);
      const digitalScore = await this.calculateDigitalAdoptionScore(kenyanFactors, transactions);

      // Calculate weighted overall score
      const overallScore = Math.round(
        (paymentHistoryScore * KENYAN_CREDIT_WEIGHTS.paymentHistory) +
        (mpesaScore * KENYAN_CREDIT_WEIGHTS.mpesaConsistency) +
        (saccoScore * KENYAN_CREDIT_WEIGHTS.saccoMembership) +
        (incomeStabilityScore * KENYAN_CREDIT_WEIGHTS.incomeStability) +
        (communityScore * KENYAN_CREDIT_WEIGHTS.communityTrust) +
        (assetScore * KENYAN_CREDIT_WEIGHTS.assetOwnership) +
        (digitalScore * KENYAN_CREDIT_WEIGHTS.digitalAdoption)
      );

      // Convert to credit score range (300-850)
      const creditScore = Math.round(300 + (overallScore * 5.5));

      // Determine risk level
      const riskLevel = this.determineRiskLevel(creditScore);

      // Calculate confidence level based on data availability
      const confidenceLevel = this.calculateConfidenceLevel(documents, transactions, kenyanFactors);

      // Generate recommendations and risk indicators
      const recommendations = this.generateRecommendations(creditScore, {
        paymentHistoryScore,
        mpesaScore,
        saccoScore,
        incomeStabilityScore,
        communityScore,
        assetScore,
        digitalScore
      });

      const riskIndicators = this.identifyRiskIndicators(creditScore, kenyanFactors, transactions);

      // Update Kenyan factors with calculated scores
      await this.updateKenyanFactors(customerId, {
        mpesa_score: mpesaScore,
        sacco_score: saccoScore,
        overall_credit_score: creditScore,
        risk_level: riskLevel,
        confidence_score: confidenceLevel
      });

      // Save credit assessment
      await this.saveCreditAssessment(customerId, {
        creditScore,
        riskLevel,
        confidenceLevel,
        paymentHistoryScore,
        mpesaScore,
        saccoScore,
        incomeStabilityScore,
        communityScore,
        assetScore,
        digitalScore,
        recommendations,
        riskIndicators
      });

      return {
        creditScore,
        riskLevel,
        confidenceLevel,
        factors: {
          paymentHistory: paymentHistoryScore,
          mpesaConsistency: mpesaScore,
          saccoMembership: saccoScore,
          incomeStability: incomeStabilityScore,
          communityTrust: communityScore,
          assetOwnership: assetScore,
          digitalAdoption: digitalScore
        },
        recommendations,
        riskIndicators
      };

    } catch (error) {
      this.logger.error(`Error calculating credit score for customer ${customerId}:`, error);
      throw error;
    }
  }

  private async calculatePaymentHistoryScore(transactions: TransactionHistory[]): Promise<number> {
    if (transactions.length === 0) return 50; // Default score

    // Analyze payment patterns
    const totalTransactions = transactions.length;
    const incomeTransactions = transactions.filter(t => t.transaction_type === 'income');
    const expenseTransactions = transactions.filter(t => t.transaction_type === 'expense');

    // Calculate income consistency
    const incomeConsistency = this.calculateIncomeConsistency(incomeTransactions);
    
    // Calculate expense patterns
    const expenseRatio = expenseTransactions.length / totalTransactions;
    
    // Base score calculation
    let score = 60; // Base score

    // Adjust based on transaction volume
    if (totalTransactions > 100) score += 10;
    else if (totalTransactions > 50) score += 5;

    // Adjust based on income consistency
    score += incomeConsistency * 0.3;

    // Adjust based on expense ratio (lower is better)
    if (expenseRatio < 0.7) score += 10;
    else if (expenseRatio > 0.9) score -= 10;

    return Math.min(100, Math.max(1, Math.round(score)));
  }

  private async calculateMpesaScore(transactions: TransactionHistory[], factors: KenyanCreditFactors): Promise<number> {
    const mpesaTransactions = transactions.filter(t => t.source_type === SourceType.MPESA);
    
    if (mpesaTransactions.length === 0) return 30; // Low score for no M-Pesa usage

    let score = 50; // Base score

    // Transaction volume score
    const monthlyTransactions = mpesaTransactions.length / 12; // Assuming 1 year of data
    if (monthlyTransactions > 20) score += 20;
    else if (monthlyTransactions > 10) score += 10;
    else if (monthlyTransactions < 5) score -= 10;

    // Utility payments (indicates responsible bill payment)
    const utilityPayments = mpesaTransactions.filter(t => 
      t.description?.toLowerCase().includes('bill') || 
      t.description?.toLowerCase().includes('utility')
    );
    if (utilityPayments.length > 10) score += 15;

    // Merchant payments (indicates business activity)
    const merchantPayments = mpesaTransactions.filter(t => 
      t.description?.toLowerCase().includes('merchant') ||
      t.description?.toLowerCase().includes('till')
    );
    if (merchantPayments.length > 0) score += 10;

    // Consistency score from factors
    if (factors?.mpesa_payment_consistency_score) {
      score += (factors.mpesa_payment_consistency_score - 50) * 0.4;
    }

    return Math.min(100, Math.max(1, Math.round(score)));
  }

  private async calculateSaccoScore(factors: KenyanCreditFactors): Promise<number> {
    if (!factors || !factors.sacco_membership_duration_months) return 20; // Low score for no SACCO

    let score = 40; // Base score for SACCO membership

    // Duration score
    const years = factors.sacco_membership_duration_months / 12;
    if (years > 5) score += 30;
    else if (years > 2) score += 20;
    else if (years > 1) score += 10;

    // Contribution consistency
    if (factors.sacco_monthly_contribution_avg > 0) {
      score += 15;
    }

    // Loan repayment history
    if (factors.sacco_loan_repayment_score) {
      score += (factors.sacco_loan_repayment_score - 50) * 0.3;
    }

    return Math.min(100, Math.max(1, Math.round(score)));
  }

  private async calculateIncomeStabilityScore(transactions: TransactionHistory[], factors: KenyanCreditFactors): Promise<number> {
    const incomeTransactions = transactions.filter(t => t.transaction_type === 'income');
    
    if (incomeTransactions.length === 0) return 30;

    let score = 50; // Base score

    // Income consistency
    const consistency = this.calculateIncomeConsistency(incomeTransactions);
    score += consistency * 0.4;

    // Employment duration from factors
    if (factors?.employment_duration_months) {
      const years = factors.employment_duration_months / 12;
      if (years > 3) score += 20;
      else if (years > 1) score += 10;
    }

    // Business registration status
    if (factors?.business_registration_status === 'registered') {
      score += 15;
    }

    return Math.min(100, Math.max(1, Math.round(score)));
  }

  private async calculateCommunityTrustScore(factors: KenyanCreditFactors): Promise<number> {
    let score = 50; // Base score

    if (factors?.community_reference_score) {
      score = factors.community_reference_score;
    }

    // Family support availability
    if (factors?.family_financial_support_available) {
      score += 10;
    }

    // Chama participation
    if (factors?.chama_participation_count > 0) {
      score += factors.chama_participation_count * 5;
    }

    return Math.min(100, Math.max(1, Math.round(score)));
  }

  private async calculateAssetOwnershipScore(factors: KenyanCreditFactors): Promise<number> {
    let score = 30; // Base score

    // Land ownership
    if (factors?.land_ownership_value > 0) {
      score += 30;
    }

    // Vehicle ownership
    if (factors?.vehicle_ownership_value > 0) {
      score += 20;
    }

    // Asset diversification
    if (factors?.asset_diversification_score) {
      score += (factors.asset_diversification_score - 50) * 0.4;
    }

    return Math.min(100, Math.max(1, Math.round(score)));
  }

  private async calculateDigitalAdoptionScore(factors: KenyanCreditFactors, transactions: TransactionHistory[]): Promise<number> {
    let score = 40; // Base score

    // Digital payment usage
    const digitalTransactions = transactions.filter(t => 
      t.source_type === SourceType.MPESA || 
      t.description?.toLowerCase().includes('online')
    );

    if (digitalTransactions.length > transactions.length * 0.5) {
      score += 20;
    }

    // Online business presence
    if (factors?.online_business_presence) {
      score += 15;
    }

    // Social media business activity
    if (factors?.social_media_business_activity) {
      score += 10;
    }

    return Math.min(100, Math.max(1, Math.round(score)));
  }

  private calculateIncomeConsistency(incomeTransactions: TransactionHistory[]): number {
    if (incomeTransactions.length < 3) return 30;

    const amounts = incomeTransactions.map(t => t.amount);
    const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const variance = amounts.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / amounts.length;
    const standardDeviation = Math.sqrt(variance);
    
    // Lower standard deviation relative to mean indicates higher consistency
    const coefficientOfVariation = standardDeviation / mean;
    
    // Convert to 1-100 score (lower variation = higher score)
    return Math.min(100, Math.max(1, Math.round(100 - (coefficientOfVariation * 100))));
  }

  private determineRiskLevel(creditScore: number): RiskLevel {
    if (creditScore >= 700) return RiskLevel.LOW;
    if (creditScore >= 600) return RiskLevel.MEDIUM;
    if (creditScore >= 500) return RiskLevel.HIGH;
    return RiskLevel.VERY_HIGH;
  }

  private calculateConfidenceLevel(documents: FinancialDocuments[], transactions: TransactionHistory[], factors: KenyanCreditFactors): number {
    let confidence = 50; // Base confidence

    // Document availability
    if (documents.length > 3) confidence += 20;
    else if (documents.length > 1) confidence += 10;

    // Transaction data volume
    if (transactions.length > 100) confidence += 15;
    else if (transactions.length > 50) confidence += 10;

    // Data source diversity
    const sources = new Set(transactions.map(t => t.source_type));
    confidence += sources.size * 5;

    // Kenyan factors completeness
    if (factors) {
      const factorCount = Object.values(factors).filter(v => v !== null && v !== undefined).length;
      confidence += factorCount * 2;
    }

    return Math.min(100, Math.max(1, Math.round(confidence)));
  }

  private generateRecommendations(creditScore: number, scores: any): string[] {
    const recommendations: string[] = [];

    if (creditScore < 600) {
      recommendations.push("Focus on building a consistent payment history");
    }

    if (scores.mpesaScore < 60) {
      recommendations.push("Increase M-Pesa usage for utility payments and regular transactions");
    }

    if (scores.saccoScore < 50) {
      recommendations.push("Consider joining a SACCO and maintaining regular contributions");
    }

    if (scores.incomeStabilityScore < 60) {
      recommendations.push("Work on stabilizing income sources and maintaining employment");
    }

    if (scores.communityScore < 50) {
      recommendations.push("Build community references and consider joining local financial groups");
    }

    if (scores.assetScore < 40) {
      recommendations.push("Consider building assets such as property or business equipment");
    }

    return recommendations;
  }

  private identifyRiskIndicators(creditScore: number, factors: KenyanCreditFactors, transactions: TransactionHistory[]): string[] {
    const indicators: string[] = [];

    if (creditScore < 500) {
      indicators.push("Very low credit score indicates high default risk");
    }

    if (transactions.filter(t => t.transaction_type === 'income').length < 10) {
      indicators.push("Limited income transaction history");
    }

    if (!factors?.sacco_membership_duration_months) {
      indicators.push("No SACCO membership found");
    }

    if (factors?.employment_duration_months < 12) {
      indicators.push("Short employment history");
    }

    return indicators;
  }

  private async getOrCreateKenyanFactors(customerId: string): Promise<KenyanCreditFactors> {
    let factors = await this.kenyanFactorsRepository.findOne({
      where: { customer_id: customerId }
    });

    if (!factors) {
      factors = new KenyanCreditFactors();
      factors.customer_id = customerId;
      factors = await this.kenyanFactorsRepository.save(factors);
    }

    return factors;
  }

  private async getCustomerTransactions(customerId: string): Promise<TransactionHistory[]> {
    return this.transactionHistoryRepository.find({
      where: { customer_id: customerId },
      order: { transaction_date: 'DESC' }
    });
  }

  private async getCustomerDocuments(customerId: string): Promise<FinancialDocuments[]> {
    return this.financialDocumentsRepository.find({
      where: { customer_id: customerId },
      order: { upload_date: 'DESC' }
    });
  }

  private async updateKenyanFactors(customerId: string, updates: any): Promise<void> {
    await this.kenyanFactorsRepository.update(
      { customer_id: customerId },
      { ...updates, last_updated: new Date() }
    );
  }

  private async saveCreditAssessment(customerId: string, assessmentData: any): Promise<void> {
    const assessment = new CreditAssessments();
    assessment.customer_id = customerId;
    assessment.credit_score = assessmentData.creditScore;
    assessment.risk_level = assessmentData.riskLevel;
    assessment.confidence_level = assessmentData.confidenceLevel;
    assessment.payment_history_score = assessmentData.paymentHistoryScore;
    assessment.mpesa_score = assessmentData.mpesaScore;
    assessment.sacco_score = assessmentData.saccoScore;
    assessment.employment_score = assessmentData.incomeStabilityScore;
    assessment.community_score = assessmentData.communityScore;
    assessment.factors = assessmentData.factors;
    assessment.recommendations = assessmentData.recommendations;
    assessment.risk_indicators = assessmentData.riskIndicators;
    assessment.assessment_method = AssessmentMethod.AUTOMATED;
    assessment.data_sources_used = ['transactions', 'documents', 'kenyan_factors'];

    await this.creditAssessmentsRepository.save(assessment);
  }
}
