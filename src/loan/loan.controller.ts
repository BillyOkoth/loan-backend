import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { LoanService } from './loan.service';
import { CreateLoanDto, UpdateLoanDto } from './dto';

@Controller('loans')
export class LoanController {
  constructor(private readonly loanService: LoanService) {}

  @Post()
  async createLoan(@Body() createLoanDto: CreateLoanDto) {
    return this.loanService.create(createLoanDto);
  }

  @Get()
  async getAllLoans(@Query('page') page: number = 1, @Query('limit') limit: number = 10) {
    return this.loanService.findAll(page, limit);
  }

  @Get(':id')
  async getLoanById(@Param('id') id: string) {
    return this.loanService.findById(id);
  }

  @Put(':id')
  async updateLoan(@Param('id') id: string, @Body() updateLoanDto: UpdateLoanDto) {
    return this.loanService.update(id, updateLoanDto);
  }

  @Delete(':id')
  async deleteLoan(@Param('id') id: string) {
    return this.loanService.delete(id);
  }

  @Post(':id/approve')
  async approveLoan(@Param('id') id: string) {
    return this.loanService.approveLoan(id);
  }

  @Post(':id/reject')
  async rejectLoan(@Param('id') id: string, @Body() reason: { reason: string }) {
    return this.loanService.rejectLoan(id, reason.reason);
  }

  @Get('customer/:customerId')
  async getLoansByCustomer(@Param('customerId') customerId: string) {
    return this.loanService.findByCustomerId(customerId);
  }
}
