import { Injectable, Logger, Optional } from '@nestjs/common';
import { DatabaseStrategyFactory } from '../config/database.strategy';
import { ConfigService } from '@nestjs/config';

interface DocumentProcessingOptions {
  documentType: string;
  customerId: string;
  documentId: number;
  chunkIndex?: number;      // Add these optional
  totalChunks?: number;     // properties
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private requestQueue: Promise<any> = Promise.resolve();
  private readonly RETRY_ATTEMPTS = 3;
  private readonly BASE_DELAY = 1000; // 1 second
  private readonly DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
  private readonly DEEPSEEK_MODEL = 'deepseek-chat'; // Use current recommended model
  private readonly OLLAMA_API_URL = 'http://localhost:11434/api/chat'; // Default Ollama URL
  private readonly OLLAMA_MODEL = 'phi3:mini'; // Lightweight model for financial data

  constructor(
    @Optional() private readonly databaseStrategyFactory: DatabaseStrategyFactory,
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
    async processDocumentText(text: string, options: DocumentProcessingOptions): Promise<any> {
      return new Promise((resolve, reject) => {
        this.requestQueue = this.requestQueue.then(async () => {
          for (let attempt = 0; attempt < this.RETRY_ATTEMPTS; attempt++) {
            try {
              const apiKey = this.configService.get<string>('AI_API_KEY');
              if (!apiKey) {
                throw new Error('AI_API_KEY not configured');
              }
         
  
              const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${apiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  model: 'o4-mini',
                  messages: [
                    { role: 'system', content: 'Extract structured data from financial documents. Return transactions and metadata in JSON format.' },
                    { role: 'user', content: `Document type: ${options.documentType}\n\nContent:\n${text}` }
                  ],
                  temperature: 0.3,
                  max_tokens: 2000 
                })
              });
              this.logger.log('OpenAI API response:', response.status);
              if (response.status === 429) {
                this.logger.warn(`Rate limit hit, attempt ${attempt + 1}/${this.RETRY_ATTEMPTS}`);
                await this.exponentialBackoff(attempt);
                continue;
              }
  
              if (!response.ok) {
                throw new Error(`OpenAI API error: ${response.statusText}`);
              }
  
              const data = await response.json();
              this.logger.log('OpenAI  response data:', data);
              resolve({
                success: true,
                content: data.choices[0]?.message?.content,
                usage: data.usage
              });
              return;
  
            } catch (error) {
              if (attempt === this.RETRY_ATTEMPTS - 1) {
                this.logger.error(`Failed after ${this.RETRY_ATTEMPTS} attempts:`, error);
                reject(error);
              } else {
                this.logger.warn(`Attempt ${attempt + 1} failed, retrying...`);
                await this.exponentialBackoff(attempt);
              }
            }
          }
        });
      });
    } 

    async processWithDeepSeek(text: string, options: DocumentProcessingOptions): Promise<any> {
      return new Promise((resolve, reject) => {
        this.requestQueue = this.requestQueue.then(async () => {
          for (let attempt = 0; attempt < this.RETRY_ATTEMPTS; attempt++) {
            try {
              // const apiKey = this.configService.get<string>('DEEPSEEK_API_KEY');
              const apiKey = 'sk-f46871766960414c822b30955015912b';
              if (!apiKey) throw new Error('DEEPSEEK_API_KEY not configured');
    
              const response = await fetch(this.DEEPSEEK_API_URL, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${apiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  model: this.DEEPSEEK_MODEL,
                  messages: [
                    { 
                      role: 'system', 
                      content: `Extract financial data as JSON with this structure:
    {
      "account_number": string,
      "account_name": string,
      "statement_period": { "start": "DD/MM/YYYY", "end": "DD/MM/YYYY" },
      "transactions": [{
        "date": "DD/MM/YYYY",
        "description": string,
        "amount": number,
        "balance": number,
        "type": "debit" | "credit"
      }],
      "summary": {
        "opening_balance": number,
        "closing_balance": number,
        "total_credits": number,
        "total_debits": number
      }
    }
    Convert amounts to numbers without commas. Identify transaction types.` 
                    },
                    { 
                      role: 'user', 
                      content: `DOCUMENT TYPE: ${options.documentType}\n\n${text}`
                    }
                  ],
                  temperature: 0.1, // Lower for financial data
                  response_format: { type: "json_object" }, // Critical for JSON output
                  max_tokens: 4000
                })
              });
    
              if (response.status === 429) {
                await this.exponentialBackoff(attempt);
                continue;
              }
    
              if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`DeepSeek API error ${response.status}: ${errorBody}`);
              }
    
              const data = await response.json();
              const content = data.choices[0]?.message?.content;
              
              // Validate JSON structure
              const parsed = JSON.parse(content);
              if (!parsed.transactions || !Array.isArray(parsed.transactions)) {
                throw new Error('Invalid JSON structure from DeepSeek');
              }
    
              resolve({
                success: true,
                content: parsed,
                usage: data.usage
              });
              return;
    
            } catch (error) {
              if (attempt === this.RETRY_ATTEMPTS - 1) {
                this.logger.error(`DeepSeek processing failed after ${this.RETRY_ATTEMPTS} attempts`, error);
                reject(error);
              } else {
                await this.exponentialBackoff(attempt);
              }
            }
          }
        });
      });
    }

    async processWithOllama(text: string, options: DocumentProcessingOptions): Promise<any> {
      return new Promise((resolve, reject) => {
        this.requestQueue = this.requestQueue.then(async () => {
          for (let attempt = 0; attempt < this.RETRY_ATTEMPTS; attempt++) {
            try {
              const response = await fetch(this.OLLAMA_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  model: this.OLLAMA_MODEL,
                  stream: false, // Disable streaming for JSON response
                  format: 'json', // Force JSON output
                  messages: [
                    { 
                      role: 'system', 
                      content: `Extract financial data as JSON. Follow this exact structure:
{
  "account_number": string,
  "account_name": string,
  "statement_period": { "start": "DD/MM/YYYY", "end": "DD/MM/YYYY" },
  "transactions": [{
    "date": "DD/MM/YYYY",
    "description": string,
    "amount": number,
    "balance": number,
    "type": "debit" | "credit"
  }],
  "summary": {
    "opening_balance": number,
    "closing_balance": number,
    "total_credits": number,
    "total_debits": number
  }
}
Rules:
1. Convert amounts to numbers (remove commas and currency symbols)
2. Negative amounts = debit, positive = credit
3. Use exact date format DD/MM/YYYY
4. Calculate summary metrics from transactions` 
                    },
                    { 
                      role: 'user', 
                      content: `BANK STATEMENT EXTRACTION\nDocument Type: ${options.documentType}\n\n${text}`
                    }
                  ],
                  options: {
                    temperature: 0.1, // Low for accuracy
                    num_ctx: 4096 // Context window size
                  }
                })
              });
              this.logger.log('Ollama API response:', response.status);

              if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`Ollama API error ${response.status}: ${errorBody}`);
              }

              const data = await response.json();
              const content = data.message?.content;
              
              if (!content) throw new Error('Empty response from Ollama');
              
              // Parse and validate JSON
              let parsed;
              try {
                parsed = JSON.parse(content);
              } catch (e) {
                throw new Error('Invalid JSON from Ollama: ' + e.message);
              }

              // Validate response structure
              if (!parsed.transactions || !Array.isArray(parsed.transactions)) {
                throw new Error('Missing transactions array in response');
              }

              resolve({
                success: true,
                content: parsed,
                usage: { 
                  input_tokens: data.prompt_eval_count,
                  output_tokens: data.eval_count 
                }
              });
              return;

            } catch (error) {
              if (attempt === this.RETRY_ATTEMPTS - 1) {
                this.logger.error(`Ollama processing failed after ${this.RETRY_ATTEMPTS} attempts`, error);
                reject(error);
              } else {
                await this.exponentialBackoff(attempt);
              }
            }
          }
        });
      });
    }

    
    

    
  // async processDocumentText(text: string, options: { documentType: string; customerId: string; documentId: number }): Promise<any> {
  //   const apiKey = this.configService.get<string>('AI_API_KEY');

  //   try {
  //     this.logger.debug(`Using API key: ${apiKey?.substring(0, 10)}...`);

  //     if (!apiKey) {
  //       this.logger.warn('AI_API_KEY not set; returning empty result');
  //       return { success: false, error: 'AI service not configured' };
  //     }
  //   } catch (error) {
  //     this.logger.error('Failed to read AI_API_KEY:', error);
  //     return { success: false, error: 'Failed to read AI configuration' };
  //   }
    

  //   try {
  //       const response = await fetch('https://api.openai.com/v1/chat/completions', {
  //         method: 'POST',
  //         headers: {
  //           'Authorization': `Bearer ${apiKey}`,
  //           'Content-Type': 'application/json',
  //         },
  //         body: JSON.stringify({
  //           model: 'gpt-4o',
  //           messages: [
  //             {
  //               role: 'system',
  //               content: 'Extract structured data from financial documents. Return transactions and metadata in JSON format.'
  //             },
  //             {
  //               role: 'user',
  //               content: `Document type: ${options.documentType}\n\nContent:\n${text}`
  //             }
  //           ],
  //           temperature: 0.3,
  //           max_tokens: 4000 
  //         })
  //       });

  //     if (!response.ok) {
  //       throw new Error(`OpenAI API error: ${response.statusText}`);
  //     }
  //     this.logger.log('OpenAI API response:', response);
  //     const data = await response.json();
  //     const content = data.choices[0]?.message?.content;
      
  //     try {
  //       const parsed = JSON.parse(content);
  //       return {
  //         success: true,
  //         transactions: parsed.transactions || [],
  //         metadata: parsed.metadata || {},
  //       };
  //     } catch (e) {
  //       return {
  //         success: false,
  //         error: 'Failed to parse AI response'
  //       };
  //     }
  //   } catch (error) {
  //     this.logger.error('AI processing failed:', error);
  //     return {
  //       success: false,
  //       error: error.message
  //     };
  //   }
  // }

  async generateEmbedding(content: string, databaseType: 'oracle' | 'postgres' = 'postgres'): Promise<any> {
    try {
      this.logger.log(`Generating embedding for content: ${content.substring(0, 100)}...`);
      
      if (!this.databaseStrategyFactory) {
        const embedding = await this.generatePostgresEmbedding(content);
        return { success: true, embedding, databaseType: 'postgres', message: 'Embedding generated (fallback)' };
      }
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

  private async exponentialBackoff(attempt: number): Promise<void> {
    const delayTime = Math.min(
      this.BASE_DELAY * Math.pow(2, attempt),
      10000 // Max 10 seconds
    );
    await new Promise(resolve => setTimeout(resolve, delayTime));
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
      if (!this.databaseStrategyFactory) {
        throw new Error('DatabaseStrategyFactory not available in current module');
      }
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
      
      if (!this.databaseStrategyFactory) {
        throw new Error('DatabaseStrategyFactory not available in current module');
      }
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
