import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('client_debt')
export class ClientDebt {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text', nullable: true })
  customer_id: string;

  @Column({ type: 'integer', nullable: true })
  application_id: number;

  @Column({ type: 'text', nullable: true })
  debt_type: string;

  @Column({ type: 'numeric', nullable: true })
  debt_amount: number;
}
