import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Client } from './client.entity';

export enum SourceType {
  BANK = 'bank',
  MPESA = 'mpesa',
  SACCO = 'sacco',
  CASH = 'cash',
  OTHER = 'other'
}

export enum TransactionType {
  INCOME = 'income',
  EXPENSE = 'expense',
  TRANSFER = 'transfer',
  PAYMENT = 'payment',
  WITHDRAWAL = 'withdrawal',
  DEPOSIT = 'deposit'
}

@Entity('transaction_history')
export class TransactionHistory {
  @PrimaryGeneratedColumn()
  transaction_id: number;

  @Column({ type: 'text' })
  customer_id: string;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'customer_id' })
  customer: Client;

  @Column({
    type: 'enum',
    enum: SourceType
  })
  source_type: SourceType;

  @Column({ type: 'date' })
  transaction_date: Date;

  @Column({
    type: 'enum',
    enum: TransactionType
  })
  transaction_type: TransactionType;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'text' })
  category: string;

  @Column({ type: 'text', nullable: true })
  subcategory: string;

  @Column({ type: 'text', nullable: true })
  merchant: string;

  @Column({ type: 'text', nullable: true })
  account_type: string;

  @Column({ type: 'text', nullable: true })
  reference_number: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  balance_after: number;

  @CreateDateColumn()
  created_at: Date;
}
