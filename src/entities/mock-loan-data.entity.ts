import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('mock_loan_data')
export class MockLoanData {
  @PrimaryGeneratedColumn()
  loan_id: number;

  @Column({ type: 'text', nullable: true })
  loan_provider_name: string;

  @Column({ type: 'text', nullable: true })
  loan_type: string;

  @Column({ type: 'numeric', nullable: true })
  interest_rate: number;

  @Column({ type: 'numeric', nullable: true })
  origination_fee: number;

  @Column({ type: 'integer', nullable: true })
  time_to_close: number;

  @Column({ type: 'integer', nullable: true })
  credit_score: number;

  @Column({ type: 'numeric', nullable: true })
  debt_to_income_ratio: number;

  @Column({ type: 'numeric', nullable: true })
  income: number;

  @Column({ type: 'numeric', nullable: true })
  down_payment_percent: number;

  @Column({ type: 'text', nullable: true })
  is_first_time_home_buyer: string;

  @Column({ type: 'date', default: () => 'CURRENT_DATE' })
  offer_begin_date: Date;

  @Column({ type: 'date', default: () => 'CURRENT_DATE + INTERVAL \'30 days\'' })
  offer_end_date: Date;
}
