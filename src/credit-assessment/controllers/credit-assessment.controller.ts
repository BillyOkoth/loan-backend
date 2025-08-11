import { 
  Controller, 
  Post, 
  Get, 
  Delete,
  Put,
  Body, 
  Param, 
  UploadedFile, 
  UseInterceptors,
  BadRequestException,
  HttpStatus,
  HttpCode
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiParam } from '@nestjs/swagger';

// Services
import { CreditAssessmentService, UploadDocumentDto } from '../services/credit-assessment.service';

// DTOs and types
import { DocumentType } from '../../entities/financial-documents.entity';

@ApiTags('Credit Assessment')
@Controller('api/credit-assessment')
export class CreditAssessmentController {
  constructor(
    private readonly creditAssessmentService: CreditAssessmentService,
  ) {}

  @Post('upload-document')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload financial document for credit assessment' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Document uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid file or request data' })
  async uploadDocument(
    @UploadedFile() file: any,
    @Body('customerId') customerId: string,
    @Body('documentType') documentType: string,
    @Body('additionalData') additionalData?: string
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    if (!customerId) {
      throw new BadRequestException('Customer ID is required');
    }

    if (!documentType || !Object.values(DocumentType).includes(documentType as DocumentType)) {
      throw new BadRequestException('Valid document type is required');
    }

    let parsedAdditionalData;
    if (additionalData) {
      try {
        parsedAdditionalData = JSON.parse(additionalData);
      } catch (error) {
        // If JSON parsing fails, treat it as a simple string note
        parsedAdditionalData = { note: additionalData };
      }
    }

    const uploadData: UploadDocumentDto = {
      customerId,
      documentType: documentType as DocumentType,
      additionalData: parsedAdditionalData
    };

    return this.creditAssessmentService.uploadDocument(uploadData, file);
  }

  @Post('assess/:customerId')
  @ApiOperation({ summary: 'Perform credit assessment for a customer' })
  @ApiParam({ name: 'customerId', description: 'Customer ID' })
  @ApiResponse({ status: 200, description: 'Credit assessment completed successfully' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  async performAssessment(@Param('customerId') customerId: string) {
    return this.creditAssessmentService.performCreditAssessment(customerId);
  }

  @Get('score/:customerId')
  @ApiOperation({ summary: 'Get latest credit score for a customer' })
  @ApiParam({ name: 'customerId', description: 'Customer ID' })
  @ApiResponse({ status: 200, description: 'Credit score retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Customer or assessment not found' })
  async getCreditScore(@Param('customerId') customerId: string) {
    return this.creditAssessmentService.getCreditScore(customerId);
  }

  @Get('history/:customerId')
  @ApiOperation({ summary: 'Get credit assessment history for a customer' })
  @ApiParam({ name: 'customerId', description: 'Customer ID' })
  @ApiResponse({ status: 200, description: 'Credit history retrieved successfully' })
  async getCreditHistory(@Param('customerId') customerId: string) {
    return this.creditAssessmentService.getCreditHistory(customerId);
  }

  @Get('factors/:customerId')
  @ApiOperation({ summary: 'Get Kenyan credit factors for a customer' })
  @ApiParam({ name: 'customerId', description: 'Customer ID' })
  @ApiResponse({ status: 200, description: 'Credit factors retrieved successfully' })
  async getCreditFactors(@Param('customerId') customerId: string) {
    return this.creditAssessmentService.getCreditFactors(customerId);
  }

  @Put('factors/:customerId')
  @ApiOperation({ summary: 'Update Kenyan credit factors for a customer' })
  @ApiParam({ name: 'customerId', description: 'Customer ID' })
  @ApiResponse({ status: 200, description: 'Credit factors updated successfully' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  async updateCreditFactors(
    @Param('customerId') customerId: string,
    @Body() factorsData: any
  ) {
    return this.creditAssessmentService.updateKenyanFactors(customerId, factorsData);
  }

  @Get('summary/:customerId')
  @ApiOperation({ summary: 'Get assessment summary for a customer' })
  @ApiParam({ name: 'customerId', description: 'Customer ID' })
  @ApiResponse({ status: 200, description: 'Assessment summary retrieved successfully' })
  async getAssessmentSummary(@Param('customerId') customerId: string) {
    return this.creditAssessmentService.getAssessmentSummary(customerId);
  }

  @Get('risk-analysis/:customerId')
  @ApiOperation({ summary: 'Get detailed risk analysis for a customer' })
  @ApiParam({ name: 'customerId', description: 'Customer ID' })
  @ApiResponse({ status: 200, description: 'Risk analysis retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Customer or assessment not found' })
  async getRiskAnalysis(@Param('customerId') customerId: string) {
    return this.creditAssessmentService.getRiskAnalysis(customerId);
  }

  @Post('reference/:customerId')
  @ApiOperation({ summary: 'Add customer reference for credit assessment' })
  @ApiParam({ name: 'customerId', description: 'Customer ID' })
  @ApiResponse({ status: 201, description: 'Reference added successfully' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  async addCustomerReference(
    @Param('customerId') customerId: string,
    @Body() referenceData: any
  ) {
    return this.creditAssessmentService.addCustomerReference(customerId, referenceData);
  }

  @Get('references/:customerId')
  @ApiOperation({ summary: 'Get customer references' })
  @ApiParam({ name: 'customerId', description: 'Customer ID' })
  @ApiResponse({ status: 200, description: 'References retrieved successfully' })
  async getCustomerReferences(@Param('customerId') customerId: string) {
    return this.creditAssessmentService.getCustomerReferences(customerId);
  }

  @Get('documents/:customerId')
  @ApiOperation({ summary: 'Get uploaded documents for a customer' })
  @ApiParam({ name: 'customerId', description: 'Customer ID' })
  @ApiResponse({ status: 200, description: 'Documents retrieved successfully' })
  async getCustomerDocuments(@Param('customerId') customerId: string) {
    return this.creditAssessmentService.getCustomerDocuments(customerId);
  }

  @Delete('document/:documentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a document' })
  @ApiParam({ name: 'documentId', description: 'Document ID' })
  @ApiResponse({ status: 204, description: 'Document deleted successfully' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  async deleteDocument(@Param('documentId') documentId: string) {
    const numericId = parseInt(documentId, 10);
    if (isNaN(numericId)) {
      throw new BadRequestException('Invalid document ID');
    }
    
    return this.creditAssessmentService.deleteDocument(numericId);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get system statistics for credit assessment' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  async getSystemStats() {
    return this.creditAssessmentService.getSystemStats();
  }

  @Get('health')
  @ApiOperation({ summary: 'Health check for credit assessment service' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  async healthCheck() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'credit-assessment',
      version: '1.0.0'
    };
  }
}
