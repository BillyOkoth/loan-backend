import { DataSource, DataSourceOptions } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { config } from 'dotenv';

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
import { FinancialDocuments } from './src/entities/financial-documents.entity';
import { TransactionHistory } from './src/entities/transaction-history.entity';
import { KenyanCreditFactors } from './src/entities/kenyan-credit-factors.entity';
import { CreditAssessments } from './src/entities/credit-assessments.entity';
import { CustomerReferences } from './src/entities/customer-references.entity';
import { DocumentProcessingQueue } from './src/entities/document-processing-queue.entity';

// Load .env file
config();

// Initialize ConfigService with process.env
const configService = new ConfigService();

const entities = [
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
  FinancialDocuments,
  TransactionHistory,
  KenyanCreditFactors,
  CreditAssessments,
  CustomerReferences,
  DocumentProcessingQueue,
];

const getDataSourceOptions = (): DataSourceOptions => {
  // Log database connection details (except sensitive info)
  console.log('Environment Variables:', {
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_TYPE: process.env.DATABASE_TYPE,
    POSTGRES_HOST: process.env.POSTGRES_HOST,
    POSTGRES_PORT: process.env.POSTGRES_PORT,
    POSTGRES_DB: process.env.POSTGRES_DB,
    hasUser: !!process.env.POSTGRES_USER,
    hasPassword: !!process.env.POSTGRES_PASSWORD,
  });

  console.log('ConfigService Values:', {
    type: configService.get('DATABASE_TYPE'),
    host: configService.get('POSTGRES_HOST'),
    port: configService.get('POSTGRES_PORT'),
    database: configService.get('POSTGRES_DB'),
    hasUser: !!configService.get('POSTGRES_USER'),
    hasPassword: !!configService.get('POSTGRES_PASSWORD'),
  });

  const databaseType = configService.get<string>('DATABASE_TYPE', 'postgres');
  
  if (databaseType === 'oracle') {
    return {
      type: 'oracle',
      host: configService.get<string>('ORACLE_HOST'),
      port: configService.get<number>('ORACLE_PORT'),
      username: configService.get<string>('ORACLE_USER'),
      password: configService.get<string>('ORACLE_PASSWORD'),
      sid: configService.get<string>('ORACLE_SID'),
      serviceName: configService.get<string>('ORACLE_SERVICE_NAME'),
      synchronize: configService.get<boolean>('SYNCHRONIZE', false),
      logging: configService.get<boolean>('LOGGING', false),
      entities,
      migrations: ['dist/migrations/*.js'],
      subscribers: ['src/subscribers/*.ts'],
    };
  }

  // PostgreSQL configuration
  return {
    type: 'postgres',
    host: configService.get<string>('POSTGRES_HOST'),
    port: configService.get<number>('POSTGRES_PORT'),
    username: configService.get<string>('POSTGRES_USER'),
    password: configService.get<string>('POSTGRES_PASSWORD'),
    database: configService.get<string>('POSTGRES_DB'),
    synchronize: configService.get<boolean>('SYNCHRONIZE', false),
    logging: configService.get<boolean>('LOGGING', false),
    entities,
    migrations: ['dist/migrations/*.js'],
    subscribers: ['src/subscribers/*.ts'],
    ssl: process.env.NODE_ENV === 'production' ? {
      rejectUnauthorized: false,
      ca: require('fs').readFileSync('./rds-ca-rsa2048-g1.pem').toString()
    } : false,
    extra: {
      // Enable pgvector extension
      extensions: ['vector']
    },
  };
};

export const createDataSource = (): DataSource => {
  return new DataSource(getDataSourceOptions());
};

// Export the options for NestJS TypeORM module
export const getTypeOrmConfig = () => getDataSourceOptions();

// Export default DataSource for CLI commands
export default createDataSource();