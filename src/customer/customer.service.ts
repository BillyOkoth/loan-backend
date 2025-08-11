import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from '../entities/client.entity';
import { CreateCustomerDto, UpdateCustomerDto } from './dto';

@Injectable()
export class CustomerService {
  constructor(
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
  ) {}

  async create(createCustomerDto: CreateCustomerDto): Promise<Client> {
    // Check if customer with the same ID already exists
    const existingCustomer = await this.clientRepository.findOne({
      where: { customer_id: createCustomerDto.customer_id }
    });

    if (existingCustomer) {
      throw new BadRequestException(`Customer with ID ${createCustomerDto.customer_id} already exists`);
    }

    // Validate veteran status if provided
    if (createCustomerDto.veteran && !['yes', 'no'].includes(createCustomerDto.veteran.toLowerCase())) {
      throw new BadRequestException('Veteran status must be either "yes" or "no"');
    }

    // Create new client instance with validated data
    const client = this.clientRepository.create({
      ...createCustomerDto,
      veteran: createCustomerDto.veteran?.toLowerCase(), // Normalize veteran status
    });

    return await this.clientRepository.save(client);
  }

  async findAll(page: number = 1, limit: number = 10): Promise<{ 
    customers: Client[]; 
    total: number; 
    page: number; 
    limit: number;
    totalPages: number;
  }> {
    if (page < 1) throw new BadRequestException('Page must be greater than 0');
    if (limit < 1) throw new BadRequestException('Limit must be greater than 0');

    const [customers, total] = await this.clientRepository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: {
        customer_id: 'ASC' // Consistent ordering
      }
    });

    return {
      customers,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  async findById(customerId: string): Promise<Client> {
    if (!customerId) {
      throw new BadRequestException('Customer ID is required');
    }

    const client = await this.clientRepository.findOne({ 
      where: { customer_id: customerId }
    });

    if (!client) {
      throw new NotFoundException(`Customer with ID ${customerId} not found`);
    }

    return client;
  }

  async update(customerId: string, updateCustomerDto: UpdateCustomerDto): Promise<Client> {
    const client = await this.findById(customerId);
    
    // Validate veteran status if provided
    if (updateCustomerDto.veteran && !['yes', 'no'].includes(updateCustomerDto.veteran.toLowerCase())) {
      throw new BadRequestException('Veteran status must be either "yes" or "no"');
    }

    // Validate age if provided
    if (updateCustomerDto.age !== undefined && (updateCustomerDto.age < 18 || updateCustomerDto.age > 120)) {
      throw new BadRequestException('Age must be between 18 and 120');
    }

    // Validate income if provided
    if (updateCustomerDto.income !== undefined && updateCustomerDto.income < 0) {
      throw new BadRequestException('Income cannot be negative');
    }

    // Update the client with validated data
    const updatedClient = {
      ...client,
      ...updateCustomerDto,
      veteran: updateCustomerDto.veteran?.toLowerCase(), // Normalize veteran status if provided
    };
    
    return await this.clientRepository.save(updatedClient);
  }

  async delete(customerId: string): Promise<void> {
    const client = await this.findById(customerId);
    
    try {
      await this.clientRepository.remove(client);
    } catch (error) {
      throw new BadRequestException('Failed to delete customer. They may have associated records.');
    }
  }

  async getCustomerLoans(customerId: string): Promise<any[]> {
    // Verify customer exists before attempting to get loans
    await this.findById(customerId);
    
    // This would typically fetch loans from a loan service
    // For now, return empty array
    return [];
  }
}
