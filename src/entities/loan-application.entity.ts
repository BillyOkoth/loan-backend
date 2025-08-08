import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Client } from './client.entity';

@Entity('loan_applications')
export class LoanApplication {
  @PrimaryGeneratedColumn()
  application_id: number;

  @Column({ type: 'text' })
  customer_id: string;

  @Column({ type: 'numeric', nullable: true })
  requested_loan_amount: number;

  @Column({ type: 'integer', nullable: true })
  credit_score: number;

  @Column({ type: 'integer', nullable: true })
  zipcode: number;

  @Column({ type: 'text', nullable: true })
  loan_purpose: string;

  @Column({ type: 'text', nullable: true })
  loan_status: string;

  @Column({ type: 'text', nullable: true })
  student_status: string;

  @Column({ type: 'text', nullable: true })
  education_level: string;

  @Column({ type: 'text', nullable: true })
  final_decision: string;

  @Column({ type: 'text', nullable: true })
  recommendations: string;

  @Column({ type: 'numeric', nullable: true })
  total_debt: number;

  @Column({ type: 'integer', nullable: true })
  credit_rank: number;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'customer_id' })
  client: Client;
}
