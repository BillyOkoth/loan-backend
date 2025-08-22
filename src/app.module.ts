import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';

// Config
import { DatabaseStrategyFactory } from './config/database.strategy';
import { OracleService } from './config/oracle.service';
import { PostgresService } from './config/postgres.service';

// Customer Module
import { CustomerModule } from './customer/customer.module';

// Loan Module
import { LoanController } from './loan/loan.controller';
import { LoanService } from './loan/loan.service';

// AI Module
import { AiController } from './ai/ai.controller';
import { AiService } from './ai/ai.service';

// Metrics Module
import { MetricsModule } from './metrics/metrics.module';
import { MetricsMiddleware } from './metrics/metrics.middleware';

// Credit Assessment Module
import { CreditAssessmentModule } from './credit-assessment/credit-assessment.module';
import { DocumentProcessingModule } from './document-processing/document-processing.module';

// Import the TypeORM config from ormconfig
import { getTypeOrmConfig } from '../ormconfig';
import databaseConfig from './config/database.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [databaseConfig],
    }),
    // TypeOrmModule.forRoot(getTypeOrmConfig()),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const dbConfig = configService.get('database');
        console.log('Database Config:', {
          type: dbConfig.type,
          host: dbConfig.postgres.host,
          database: dbConfig.postgres.database,
          hasPassword: !!dbConfig.postgres.password,
          ssl: !!dbConfig.postgres.ssl,
          sslConfig: dbConfig.postgres.ssl,
          nodeEnv: process.env.NODE_ENV
        });
        
        return {
          type: dbConfig.type,
          host: dbConfig.postgres.host,
          port: dbConfig.postgres.port,
          username: dbConfig.postgres.username,
          password: dbConfig.postgres.password,
          database: dbConfig.postgres.database,
          synchronize: dbConfig.synchronize,
          logging: dbConfig.logging,
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          migrations: [__dirname + '/migrations/*{.ts,.js}'],
          ssl: dbConfig.postgres.ssl,
          extra: {
            ssl: dbConfig.postgres.ssl
          }
        };
      },
      inject: [ConfigService],
    }),
    MetricsModule,
    CreditAssessmentModule,
    CustomerModule,
    DocumentProcessingModule,
  ],
  controllers: [
    AppController,
    LoanController,
    AiController,
  ],
  providers: [
    AppService,
    DatabaseStrategyFactory,
    OracleService,
    PostgresService,
    LoanService,
    AiService,
  ],
})
export class AppModule implements NestModule {
  constructor(private readonly databaseStrategyFactory: DatabaseStrategyFactory) {
    // Register database strategies
    // this.databaseStrategyFactory.registerStrategy('oracle', new OracleService());
    this.databaseStrategyFactory.registerStrategy('postgres', new PostgresService());
  }

  configure(consumer: MiddlewareConsumer) {
    // Temporarily disable middleware to test basic functionality
    // consumer
    //   .apply(MetricsMiddleware)
    //   .forRoutes('*');
  }
}
