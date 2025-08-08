import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { CreateLoanDto, UpdateLoanDto } from './dto';

export enum LoanStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  DEFAULTED = 'DEFAULTED',
}

export interface Loan {
  id: string;
  customerId: string;
  amount: number;
  interestRate: number;
  term: number; // in months
  status: LoanStatus;
  purpose: string;
  monthlyPayment: number;
  totalAmount: number;
  approvedAt?: Date;
  rejectedAt?: Date;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class LoanService {
  private loans: Loan[] = [];

  async create(createLoanDto: CreateLoanDto): Promise<Loan> {
    const monthlyPayment = this.calculateMonthlyPayment(
      createLoanDto.amount,
      createLoanDto.interestRate,
      createLoanDto.term
    );

    const totalAmount = monthlyPayment * createLoanDto.term;

    const loan: Loan = {
      id: this.generateId(),
      ...createLoanDto,
      status: LoanStatus.PENDING,
      monthlyPayment,
      totalAmount,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.loans.push(loan);
    return loan;
  }

  async findAll(page: number = 1, limit: number = 10): Promise<{ loans: Loan[]; total: number; page: number; limit: number }> {
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedLoans = this.loans.slice(startIndex, endIndex);

    return {
      loans: paginatedLoans,
      total: this.loans.length,
      page,
      limit,
    };
  }

  async findById(id: string): Promise<Loan> {
    const loan = this.loans.find(l => l.id === id);
    if (!loan) {
      throw new NotFoundException(`Loan with ID ${id} not found`);
    }
    return loan;
  }

  async update(id: string, updateLoanDto: UpdateLoanDto): Promise<Loan> {
    const loanIndex = this.loans.findIndex(l => l.id === id);
    if (loanIndex === -1) {
      throw new NotFoundException(`Loan with ID ${id} not found`);
    }

    // Recalculate payments if amount, interest rate, or term changed
    if (updateLoanDto.amount || updateLoanDto.interestRate || updateLoanDto.term) {
      const currentLoan = this.loans[loanIndex];
      const amount = updateLoanDto.amount || currentLoan.amount;
      const interestRate = updateLoanDto.interestRate || currentLoan.interestRate;
      const term = updateLoanDto.term || currentLoan.term;

      const monthlyPayment = this.calculateMonthlyPayment(amount, interestRate, term);
      const totalAmount = monthlyPayment * term;

      updateLoanDto.monthlyPayment = monthlyPayment;
      updateLoanDto.totalAmount = totalAmount;
    }

    this.loans[loanIndex] = {
      ...this.loans[loanIndex],
      ...updateLoanDto,
      updatedAt: new Date(),
    };

    return this.loans[loanIndex];
  }

  async delete(id: string): Promise<void> {
    const loanIndex = this.loans.findIndex(l => l.id === id);
    if (loanIndex === -1) {
      throw new NotFoundException(`Loan with ID ${id} not found`);
    }

    this.loans.splice(loanIndex, 1);
  }

  async approveLoan(id: string): Promise<Loan> {
    const loan = await this.findById(id);
    
    if (loan.status !== LoanStatus.PENDING) {
      throw new BadRequestException(`Loan is not in PENDING status`);
    }

    loan.status = LoanStatus.APPROVED;
    loan.approvedAt = new Date();
    loan.updatedAt = new Date();

    return loan;
  }

  async rejectLoan(id: string, reason: string): Promise<Loan> {
    const loan = await this.findById(id);
    
    if (loan.status !== LoanStatus.PENDING) {
      throw new BadRequestException(`Loan is not in PENDING status`);
    }

    loan.status = LoanStatus.REJECTED;
    loan.rejectedAt = new Date();
    loan.rejectionReason = reason;
    loan.updatedAt = new Date();

    return loan;
  }

  async findByCustomerId(customerId: string): Promise<Loan[]> {
    return this.loans.filter(l => l.customerId === customerId);
  }

  private calculateMonthlyPayment(principal: number, annualRate: number, termMonths: number): number {
    const monthlyRate = annualRate / 12 / 100;
    if (monthlyRate === 0) {
      return principal / termMonths;
    }
    
    return (principal * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) / 
           (Math.pow(1 + monthlyRate, termMonths) - 1);
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }
}
