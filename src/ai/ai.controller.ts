import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common';
import { AiService } from './ai.service';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('analyze-loan')
  async analyzeLoan(@Body() loanData: any) {
    return this.aiService.analyzeLoanApplication(loanData);
  }

  @Post('generate-embedding')
  async generateEmbedding(
    @Body() text: { content: string; databaseType?: 'oracle' | 'postgres' }
  ) {
    return this.aiService.generateEmbedding(text.content, text.databaseType || 'postgres');
  }

  @Post('vector-search')
  async vectorSearch(
    @Body() searchData: { 
      embedding: number[]; 
      tableName: string; 
      limit?: number;
      databaseType?: 'oracle' | 'postgres';
    }
  ) {
    return this.aiService.vectorSearch(
      searchData.embedding, 
      searchData.tableName, 
      searchData.limit || 10,
      searchData.databaseType || 'postgres'
    );
  }

  @Post('store-vector')
  async storeVector(
    @Body() vectorData: { 
      tableName: string; 
      data: any; 
      embedding: number[];
      databaseType?: 'oracle' | 'postgres';
    }
  ) {
    return this.aiService.storeVector(
      vectorData.tableName, 
      vectorData.data, 
      vectorData.embedding,
      vectorData.databaseType || 'postgres'
    );
  }

  @Get('similar-loans/:loanId')
  async findSimilarLoans(
    @Param('loanId') loanId: string,
    @Query('databaseType') databaseType: 'oracle' | 'postgres' = 'postgres'
  ) {
    return this.aiService.findSimilarLoans(loanId, databaseType);
  }

  @Post('risk-assessment')
  async assessRisk(@Body() customerData: any) {
    return this.aiService.assessRisk(customerData);
  }

  @Post('loan-recommendation')
  async getLoanRecommendation(
    @Body() request: { 
      customerProfile: any;
      databaseType?: 'oracle' | 'postgres';
    }
  ) {
    return this.aiService.getLoanRecommendation(request.customerProfile, request.databaseType || 'postgres');
  }
}
