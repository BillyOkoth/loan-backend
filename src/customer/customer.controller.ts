import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { CustomerService } from './customer.service';
import { CreateCustomerDto,UpdateCustomerDto } from './dto'
@Controller('customers')
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Post()
  async createCustomer(@Body() createCustomerDto: CreateCustomerDto) {
    return this.customerService.create(createCustomerDto);
  }

  @Get()
  async getAllCustomers(@Query('page') page: number = 1, @Query('limit') limit: number = 10) {
    return this.customerService.findAll(page, limit);
  }

  @Get(':id')
  async getCustomerById(@Param('id') id: string) {
    return this.customerService.findById(id);
  }

  @Put(':id')
  async updateCustomer(@Param('id') id: string, @Body() updateCustomerDto: UpdateCustomerDto) {
    return this.customerService.update(id, updateCustomerDto);
  }

  @Delete(':id')
  async deleteCustomer(@Param('id') id: string) {
    return this.customerService.delete(id);
  }

  @Get(':id/loans')
  async getCustomerLoans(@Param('id') id: string) {
    return this.customerService.getCustomerLoans(id);
  }
}
