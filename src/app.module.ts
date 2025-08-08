import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';

// Config
import { DatabaseStrategyFactory } from './config/database.strategy';
import { OracleService } from './config/oracle.service';
import { PostgresService } from './config/postgres.service';

// Customer Module
import { CustomerController } from './customer/customer.controller';
import { CustomerService } from './customer/customer.service';

// Loan Module
import { LoanController } from './loan/loan.controller';
import { LoanService } from './loan/loan.service';

// AI Module
import { AiController } from './ai/ai.controller';
import { AiService } from './ai/ai.service';

// Metrics Module
import { MetricsModule } from './metrics/metrics.module';
import { MetricsMiddleware } from './metrics/metrics.middleware';

// Import the TypeORM config from ormconfig
import { getTypeOrmConfig } from '../ormconfig';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRoot(getTypeOrmConfig()),
    MetricsModule,
  ],
  controllers: [
    AppController,
    CustomerController,
    LoanController,
    AiController,
  ],
  providers: [
    AppService,
    DatabaseStrategyFactory,
    OracleService,
    PostgresService,
    CustomerService,
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
    consumer
      .apply(MetricsMiddleware)
      .forRoutes('*');
  }
}
