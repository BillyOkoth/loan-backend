import { Injectable, Logger } from '@nestjs/common';
import { DatabaseStrategyFactory } from '../config/database.strategy';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly databaseStrategyFactory: DatabaseStrategyFactory,
    private readonly configService: ConfigService,
  ) {}

  async analyzeLoanApplication(loanData: any): Promise<any> {
    try {
      // AI-powered loan analysis
      const analysis = {
        riskScore: this.calculateRiskScore(loanData),
        recommendation: this.generateRecommendation(loanData),
        confidence: this.calculateConfidence(loanData),
        factors: this.identifyKeyFactors(loanData),
        timestamp: new Date(),
      };

      return {
        success: true,
        analysis,
        message: 'Loan analysis completed successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Failed to analyze loan application',
      };
    }
  }

  async generateEmbedding(content: string, databaseType: 'oracle' | 'postgres' = 'postgres'): Promise<any> {
    try {
      this.logger.log(`Generating embedding for content: ${content.substring(0, 100)}...`);
      
      const strategy = this.databaseStrategyFactory.getStrategy(databaseType);
      
      if (databaseType === 'oracle') {
        // Use Oracle's dbms_vector_chain.utl_to_embedding
        const embedding = await this.generateOracleEmbedding(content);
        return {
          success: true,
          embedding,
          databaseType: 'oracle',
          message: 'Oracle embedding generated successfully',
        };
      } else {
        // Use pgvector or external AI service for PostgreSQL
        const embedding = await this.generatePostgresEmbedding(content);
        return {
          success: true,
          embedding,
          databaseType: 'postgres',
          message: 'PostgreSQL embedding generated successfully',
        };
      }
    } catch (error) {
      this.logger.error(`Failed to generate embedding: ${error.message}`);
      return {
        success: false,
        error: error.message,
        message: 'Failed to generate embedding',
      };
    }
  }

  private async generateOracleEmbedding(content: string): Promise<number[]> {
    // Oracle's dbms_vector_chain.utl_to_embedding implementation
    const sql = `
      SELECT dbms_vector_chain.utl_to_embedding(:content) as embedding
      FROM dual
    `;
    
    const strategy = this.databaseStrategyFactory.getStrategy('oracle');
    const result = await strategy.query(sql, [content]);
    
    if (result && result.rows && result.rows[0]) {
      // Parse Oracle embedding result
      const embeddingString = result.rows[0].embedding;
      return this.parseOracleEmbedding(embeddingString);
    }
    
    throw new Error('Failed to generate Oracle embedding');
  }

  private async generatePostgresEmbedding(content: string): Promise<number[]> {
    // For PostgreSQL, we can use external AI service or pgvector's built-in functions
    const aiApiKey = this.configService.get<string>('AI_API_KEY');
    const aiEndpoint = this.configService.get<string>('AI_MODEL_ENDPOINT');
    
    if (aiApiKey && aiEndpoint) {
      // Use external AI service (e.g., OpenAI)
      return await this.callExternalAIService(content, aiEndpoint, aiApiKey);
    } else {
      // Fallback to mock embedding for development
      this.logger.warn('No AI API configured, using mock embedding');
      return Array.from({ length: 1536 }, () => Math.random());
    }
  }

  private async callExternalAIService(content: string, endpoint: string, apiKey: string): Promise<number[]> {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: content,
          model: 'text-embedding-ada-002',
        }),
      });

      if (!response.ok) {
        throw new Error(`AI service error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data[0].embedding;
    } catch (error) {
      this.logger.error(`External AI service error: ${error.message}`);
      throw error;
    }
  }

  private parseOracleEmbedding(embeddingString: string): number[] {
    try {
      // Parse Oracle embedding string format
      // This depends on the specific format returned by dbms_vector_chain.utl_to_embedding
      if (embeddingString.startsWith('[') && embeddingString.endsWith(']')) {
        return JSON.parse(embeddingString);
      }
      
      // Handle other Oracle embedding formats
      return embeddingString.split(',').map(Number);
    } catch (error) {
      this.logger.error(`Failed to parse Oracle embedding: ${error.message}`);
      throw new Error('Invalid Oracle embedding format');
    }
  }

  async vectorSearch(embedding: number[], tableName: string, limit: number = 10, databaseType: 'oracle' | 'postgres' = 'postgres'): Promise<any> {
    try {
      this.logger.log(`Performing vector search on table: ${tableName} with limit: ${limit}`);
      
      const strategy = this.databaseStrategyFactory.getStrategy(databaseType);
      
      if (strategy.vectorSearch) {
        const results = await strategy.vectorSearch(embedding, tableName, limit);
        return {
          success: true,
          results,
          databaseType,
          message: 'Vector search completed successfully',
        };
      } else {
        throw new Error(`Vector search not supported by ${databaseType} strategy`);
      }
    } catch (error) {
      this.logger.error(`Vector search failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
        message: 'Failed to perform vector search',
      };
    }
  }

  async storeVector(tableName: string, data: any, embedding: number[], databaseType: 'oracle' | 'postgres' = 'postgres'): Promise<any> {
    try {
      this.logger.log(`Storing vector in table: ${tableName} using ${databaseType}`);
      
      const strategy = this.databaseStrategyFactory.getStrategy(databaseType);
      
      if (strategy.insertVector) {
        await strategy.insertVector(tableName, data, embedding);
        return {
          success: true,
          databaseType,
          message: 'Vector stored successfully',
        };
      } else {
        throw new Error(`Vector storage not supported by ${databaseType} strategy`);
      }
    } catch (error) {
      this.logger.error(`Vector storage failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
        message: 'Failed to store vector',
      };
    }
  }

  async findSimilarLoans(loanId: string, databaseType: 'oracle' | 'postgres' = 'postgres'): Promise<any> {
    try {
      this.logger.log(`Finding similar loans for loan ID: ${loanId} using ${databaseType}`);
      
      // First, get the loan data to generate embedding
      const loanData = await this.getLoanData(loanId);
      if (!loanData) {
        throw new Error(`Loan with ID ${loanId} not found`);
      }

      // Generate embedding for the loan recommendation text
      const recommendationText = this.generateLoanRecommendationText(loanData);
      const embedding = await this.generateEmbedding(recommendationText, databaseType);
      
      if (!embedding.success) {
        throw new Error('Failed to generate embedding for loan');
      }

      // Search for similar loans using vector similarity
      const tableName = this.configService.get<string>('VECTOR_TABLE_PREFIX', 'loan_vectors') + '_recommendations';
      const similarResults = await this.vectorSearch(embedding.embedding, tableName, 10, databaseType);
      
      if (!similarResults.success) {
        throw new Error('Failed to perform similarity search');
      }

      return {
        success: true,
        originalLoan: loanData,
        similarLoans: similarResults.results,
        databaseType,
        message: 'Similar loans found successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to find similar loans: ${error.message}`);
      return {
        success: false,
        error: error.message,
        message: 'Failed to find similar loans',
      };
    }
  }

  private async getLoanData(loanId: string): Promise<any> {
    // This would typically fetch from loan service
    // For now, return mock data
    return {
      id: loanId,
      amount: 50000,
      purpose: 'Home improvement',
      customerProfile: {
        creditScore: 750,
        income: 80000,
        employmentYears: 5,
      },
      recommendation: 'Approved with standard terms',
    };
  }

  private generateLoanRecommendationText(loanData: any): string {
    return `Loan recommendation for ${loanData.purpose} with amount $${loanData.amount}. 
    Customer credit score: ${loanData.customerProfile.creditScore}, 
    income: $${loanData.customerProfile.income}, 
    employment years: ${loanData.customerProfile.employmentYears}. 
    Recommendation: ${loanData.recommendation}`;
  }

  async assessRisk(customerData: any): Promise<any> {
    try {
      const riskAssessment = {
        riskLevel: this.calculateRiskLevel(customerData),
        riskFactors: this.identifyRiskFactors(customerData),
        recommendations: this.generateRiskRecommendations(customerData),
        score: this.calculateRiskScore(customerData),
        timestamp: new Date(),
      };

      return {
        success: true,
        riskAssessment,
        message: 'Risk assessment completed successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Failed to assess risk',
      };
    }
  }

  async getLoanRecommendation(customerProfile: any, databaseType: 'oracle' | 'postgres' = 'postgres'): Promise<any> {
    try {
      this.logger.log(`Generating loan recommendation for customer using ${databaseType}`);
      
      const recommendation = {
        recommendedAmount: this.calculateRecommendedAmount(customerProfile),
        recommendedTerm: this.calculateRecommendedTerm(customerProfile),
        recommendedRate: this.calculateRecommendedRate(customerProfile),
        reasoning: this.generateRecommendationReasoning(customerProfile),
        confidence: this.calculateConfidence(customerProfile),
        timestamp: new Date(),
      };

      // Generate embedding for the recommendation text
      const recommendationText = this.generateRecommendationText(recommendation, customerProfile);
      const embedding = await this.generateEmbedding(recommendationText, databaseType);
      
      if (embedding.success) {
        // Store the recommendation with its embedding
        const tableName = this.configService.get<string>('VECTOR_TABLE_PREFIX', 'loan_vectors') + '_recommendations';
        await this.storeVector(tableName, {
          customerProfile,
          recommendation,
          timestamp: new Date(),
        }, embedding.embedding, databaseType);
      }

      return {
        success: true,
        recommendation,
        embedding: embedding.success ? embedding.embedding : null,
        databaseType,
        message: 'Loan recommendation generated and stored successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to generate loan recommendation: ${error.message}`);
      return {
        success: false,
        error: error.message,
        message: 'Failed to generate loan recommendation',
      };
    }
  }

  private generateRecommendationText(recommendation: any, customerProfile: any): string {
    return `Loan recommendation: Amount $${recommendation.recommendedAmount}, 
    Term ${recommendation.recommendedTerm} months, Rate ${recommendation.recommendedRate}%. 
    Customer profile: Credit score ${customerProfile.creditScore || 'N/A'}, 
    Income $${customerProfile.income || 'N/A'}. 
    Reasoning: ${recommendation.reasoning}`;
  }

  // Helper methods for AI calculations
  private calculateRiskScore(data: any): number {
    // Mock risk score calculation
    return Math.floor(Math.random() * 100);
  }

  private generateRecommendation(data: any): string {
    const riskScore = this.calculateRiskScore(data);
    if (riskScore < 30) return 'APPROVE';
    if (riskScore < 60) return 'REVIEW';
    return 'REJECT';
  }

  private calculateConfidence(data: any): number {
    // Mock confidence calculation
    return Math.random() * 100;
  }

  private identifyKeyFactors(data: any): string[] {
    return ['Credit Score', 'Income', 'Employment History', 'Debt-to-Income Ratio'];
  }

  private calculateRiskLevel(data: any): string {
    const score = this.calculateRiskScore(data);
    if (score < 30) return 'LOW';
    if (score < 60) return 'MEDIUM';
    return 'HIGH';
  }

  private identifyRiskFactors(data: any): string[] {
    return ['Low Credit Score', 'High Debt-to-Income Ratio', 'Short Employment History'];
  }

  private generateRiskRecommendations(data: any): string[] {
    return ['Improve credit score', 'Reduce existing debt', 'Provide additional documentation'];
  }

  private calculateRecommendedAmount(profile: any): number {
    // Mock calculation based on income and credit score
    return Math.floor(Math.random() * 100000) + 10000;
  }

  private calculateRecommendedTerm(profile: any): number {
    // Mock calculation
    return Math.floor(Math.random() * 60) + 12;
  }

  private calculateRecommendedRate(profile: any): number {
    // Mock calculation based on risk
    return Math.random() * 10 + 2;
  }

  private generateRecommendationReasoning(profile: any): string {
    return 'Based on your credit profile and income, we recommend this loan structure to optimize your approval chances and monthly payments.';
  }
}
