import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { MockLoanData } from './mock-loan-data.entity';

@Entity('lender_terms')
export class LenderTerms {
  @PrimaryGeneratedColumn()
  terms_id: number;

  @Column({ type: 'integer', nullable: true })
  lender_id: number;

  @Column({ type: 'text', nullable: true })
  loan_description: string;

  @Column({ type: 'numeric', nullable: true })
  interest_rate_markup: number;

  @Column({ type: 'numeric', nullable: true })
  origination_fee: number;

  @Column({ type: 'integer', nullable: true })
  lender_time_to_close: number;

  @Column({ type: 'integer', nullable: true })
  credit_score: number;

  @Column({ type: 'numeric', nullable: true })
  debt_to_income_ratio: number;

  @Column({ type: 'numeric', nullable: true })
  income: number;

  @Column({ type: 'numeric', nullable: true })
  down_payment_percent: number;

  @Column({ type: 'date', nullable: true })
  offer_begin_date: Date;

  @Column({ type: 'date', nullable: true })
  offer_end_date: Date;

  @ManyToOne(() => MockLoanData)
  @JoinColumn({ name: 'lender_id' })
  lender: MockLoanData;
}
