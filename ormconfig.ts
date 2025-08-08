import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';

// Entity imports
import { Client } from './src/entities/client.entity';
import { LoanApplication } from './src/entities/loan-application.entity';
import { ClientDebt } from './src/entities/client-debt.entity';
import { MockLoanData } from './src/entities/mock-loan-data.entity';
import { LoanChunk } from './src/entities/loan-chunk.entity';
import { ClientsToLoanRecommendations } from './src/entities/clients-to-loan-recommendations.entity';
import { ClientsToLoan } from './src/entities/clients-to-loan.entity';
import { LoanProvider } from './src/entities/loan-provider.entity';
import { FundingProviderTerms } from './src/entities/funding-provider-terms.entity';
import { LenderTerms } from './src/entities/lender-terms.entity';
import { AffordableHousingZone } from './src/entities/affordable-housing-zone.entity';
import { Floodzone } from './src/entities/floodzone.entity';
const configService = new ConfigService();

export const createDataSource = (): DataSource => {
  const databaseType = configService.get<string>('DATABASE_TYPE','postgres');
  if (databaseType === 'oracle') {
    return new DataSource({
      type: 'oracle',
      host: configService.get<string>('ORACLE_HOST', 'localhost'),
      port: configService.get<number>('ORACLE_PORT', 1521),
      username: configService.get<string>('ORACLE_USER'),
      password: configService.get<string>('ORACLE_PASSWORD'),
      sid: configService.get<string>('ORACLE_SID', 'XEPDB1'),
      serviceName: configService.get<string>('ORACLE_SERVICE_NAME'),
      synchronize: configService.get<boolean>('SYNCHRONIZE', false),
      logging: configService.get<boolean>('LOGGING', true),
      entities: [
        Client,
        LoanApplication,
        ClientDebt,
        MockLoanData,
        LoanChunk,
        ClientsToLoanRecommendations,
        ClientsToLoan,
        LoanProvider,
        FundingProviderTerms,
        LenderTerms,
        AffordableHousingZone,
        Floodzone,
      ],
      migrations: ['src/migrations/*.ts'],
      subscribers: ['src/subscribers/*.ts'],
    });
  } else {
    // PostgreSQL configuration
    return new DataSource({
      type: 'postgres',
      host: configService.get<string>('POSTGRES_HOST', 'localhost'),
      port: configService.get<number>('POSTGRES_PORT', 5432),
      username: configService.get<string>('POSTGRES_USER'),
      password: configService.get<string>('POSTGRES_PASSWORD'),
      database: configService.get<string>('POSTGRES_DB', 'loan_backend'),
      synchronize: configService.get<boolean>('SYNCHRONIZE', false),
      logging: configService.get<boolean>('LOGGING', true),
      entities: [
        Client,
        LoanApplication,
        ClientDebt,
        MockLoanData,
        LoanChunk,
        ClientsToLoanRecommendations,
        ClientsToLoan,
        LoanProvider,
        FundingProviderTerms,
        LenderTerms,
        AffordableHousingZone,
        Floodzone,
      ],
      migrations: ['src/migrations/*.ts'],
      subscribers: ['src/subscribers/*.ts'],
      extra: {
        // Enable pgvector extension
        extensions: ['vector'],
      },
    });
  }
};

// Export the options for NestJS TypeORM module
export const getTypeOrmConfig = () => createDataSource().options;

export default createDataSource();
