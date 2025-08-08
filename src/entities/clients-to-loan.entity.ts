import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Client } from './client.entity';
import { MockLoanData } from './mock-loan-data.entity';
import { LoanApplication } from './loan-application.entity';

@Entity('clients_to_loan')
export class ClientsToLoan {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text' })
  customer_id: string;

  @Column({ type: 'integer', nullable: true })
  loan_id: number;

  @Column({ type: 'integer', nullable: true })
  loan_application_id: number;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'customer_id' })
  client: Client;

  @ManyToOne(() => MockLoanData)
  @JoinColumn({ name: 'loan_id' })
  loan: MockLoanData;

  @ManyToOne(() => LoanApplication)
  @JoinColumn({ name: 'loan_application_id' })
  loanApplication: LoanApplication;
}
