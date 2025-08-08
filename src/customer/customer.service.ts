import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateCustomerDto, UpdateCustomerDto } from './dto';

export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  creditScore: number;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class CustomerService {
  private customers: Customer[] = [];

  async create(createCustomerDto: CreateCustomerDto): Promise<Customer> {
    const customer: Customer = {
      id: this.generateId(),
      ...createCustomerDto,
      creditScore: createCustomerDto.creditScore || 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.customers.push(customer);
    return customer;
  }

  async findAll(page: number = 1, limit: number = 10): Promise<{ customers: Customer[]; total: number; page: number; limit: number }> {
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedCustomers = this.customers.slice(startIndex, endIndex);

    return {
      customers: paginatedCustomers,
      total: this.customers.length,
      page,
      limit,
    };
  }

  async findById(id: string): Promise<Customer> {
    const customer = this.customers.find(c => c.id === id);
    if (!customer) {
      throw new NotFoundException(`Customer with ID ${id} not found`);
    }
    return customer;
  }

  async update(id: string, updateCustomerDto: UpdateCustomerDto): Promise<Customer> {
    const customerIndex = this.customers.findIndex(c => c.id === id);
    if (customerIndex === -1) {
      throw new NotFoundException(`Customer with ID ${id} not found`);
    }

    this.customers[customerIndex] = {
      ...this.customers[customerIndex],
      ...updateCustomerDto,
      updatedAt: new Date(),
    };

    return this.customers[customerIndex];
  }

  async delete(id: string): Promise<void> {
    const customerIndex = this.customers.findIndex(c => c.id === id);
    if (customerIndex === -1) {
      throw new NotFoundException(`Customer with ID ${id} not found`);
    }

    this.customers.splice(customerIndex, 1);
  }

  async getCustomerLoans(id: string): Promise<any[]> {
    // This would typically fetch loans from a loan service
    // For now, return empty array
    return [];
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }
}
