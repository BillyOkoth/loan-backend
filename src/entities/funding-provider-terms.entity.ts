import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { LoanProvider } from './loan-provider.entity';

@Entity('funding_provider_terms')
export class FundingProviderTerms {
  @PrimaryGeneratedColumn()
  terms_id: number;

  @Column({ type: 'integer', nullable: true })
  loan_provider_id: number;

  @Column({ type: 'numeric', nullable: true })
  interest_rate: number;

  @Column({ type: 'text', nullable: true })
  loan_description: string;

  @Column({ type: 'integer', nullable: true })
  time_to_close: number;

  @Column({ type: 'numeric', nullable: true })
  loan_costs: number;

  @Column({ type: 'date', nullable: true })
  offer_begin_date: Date;

  @Column({ type: 'date', nullable: true })
  offer_end_date: Date;

  @ManyToOne(() => LoanProvider)
  @JoinColumn({ name: 'loan_provider_id' })
  loanProvider: LoanProvider;
}
