import { Injectable } from '@nestjs/common';

export interface DatabaseStrategy {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  query(sql: string, params?: any[]): Promise<any>;
  vectorSearch?(embedding: number[], tableName: string, limit: number): Promise<any[]>;
  insertVector?(tableName: string, data: any, embedding: number[]): Promise<void>;
}

@Injectable()
export class DatabaseStrategyFactory {
  private strategies: Map<string, DatabaseStrategy> = new Map();

  registerStrategy(name: string, strategy: DatabaseStrategy) {
    this.strategies.set(name, strategy);
  }

  getStrategy(name: string): DatabaseStrategy {
    const strategy = this.strategies.get(name);
    if (!strategy) {
      throw new Error(`Database strategy '${name}' not found`);
    }
    return strategy;
  }

  getAvailableStrategies(): string[] {
    return Array.from(this.strategies.keys());
  }
}
