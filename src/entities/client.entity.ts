import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('clients')
export class Client {
  @PrimaryColumn({ type: 'text' })
  customer_id: string;

  @Column({ type: 'text', nullable: true })
  first_name: string;

  @Column({ type: 'text', nullable: true })
  last_name: string;

  @Column({ type: 'text', nullable: true })
  city: string;

  @Column({ type: 'text', nullable: true })
  state: string;

  @Column({ type: 'integer', nullable: true })
  zip_code: number;

  @Column({ type: 'integer', nullable: true })
  age: number;

  @Column({ type: 'numeric', nullable: true })
  income: number;

  @Column({ type: 'text', nullable: true })
  veteran: string;
}
