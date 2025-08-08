import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('loan_provider')
export class LoanProvider {
  @PrimaryGeneratedColumn()
  loan_provider_id: number;

  @Column({ type: 'text', nullable: true })
  loan_provider_name: string;
}
