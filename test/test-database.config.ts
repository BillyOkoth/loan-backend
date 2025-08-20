import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { join } from 'path';

export const testDatabaseConfig: TypeOrmModuleOptions = {
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  username: 'postgres',
  password: 'postgres',
  database: 'loan_backend_test',
  entities: [join(__dirname, '../src/entities/*.entity{.ts,.js}')],
  synchronize: true,
  dropSchema: true,
  logging: false
};
