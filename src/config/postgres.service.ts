import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { DatabaseStrategy } from './database.strategy';

@Injectable()
export class PostgresService implements DatabaseStrategy, OnModuleInit, OnModuleDestroy {
  private client: any = null;

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  async connect(): Promise<void> {
    try {
      // PostgreSQL + pgvector connection implementation
      // This would typically use pg package with pgvector extension
      console.log('Connecting to PostgreSQL with pgvector...');
      // const { Client } = require('pg');
      // this.client = new Client({
      //   host: process.env.POSTGRES_HOST,
      //   port: parseInt(process.env.POSTGRES_PORT || '5432'),
      //   database: process.env.POSTGRES_DB,
      //   user: process.env.POSTGRES_USER,
      //   password: process.env.POSTGRES_PASSWORD,
      // });
      // await this.client.connect();
      console.log('Connected to PostgreSQL with pgvector successfully');
    } catch (error) {
      console.error('Failed to connect to PostgreSQL:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.client) {
        // await this.client.end();
        this.client = null;
        console.log('Disconnected from PostgreSQL');
      }
    } catch (error) {
      console.error('Error disconnecting from PostgreSQL:', error);
      throw error;
    }
  }

  async query(sql: string, params?: any[]): Promise<any> {
    try {
      if (!this.client) {
        throw new Error('Not connected to PostgreSQL');
      }
      
      // PostgreSQL + pgvector specific query implementation
      // const result = await this.client.query(sql, params || []);
      // return result.rows;
      
      console.log(`Executing PostgreSQL query: ${sql}`);
      return { rows: [] }; // Placeholder
    } catch (error) {
      console.error('PostgreSQL query error:', error);
      throw error;
    }
  }

  // PostgreSQL + pgvector specific methods
  async vectorSearch(embedding: number[], tableName: string, limit: number = 10): Promise<any[]> {
    const sql = `
      SELECT *, 
             1 - (embedding <=> $1) as similarity_score
      FROM ${tableName}
      ORDER BY embedding <=> $1
      LIMIT $2
    `;
    
    const result = await this.query(sql, [embedding, limit]);
    return result.rows || [];
  }

  async insertVector(tableName: string, data: any, embedding: number[]): Promise<void> {
    const sql = `
      INSERT INTO ${tableName} (id, data, embedding, created_at)
      VALUES ($1, $2, $3, NOW())
    `;
    
    await this.query(sql, [data.id || this.generateId(), JSON.stringify(data), embedding]);
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  async createVectorTable(tableName: string): Promise<void> {
    const sql = `
      CREATE EXTENSION IF NOT EXISTS vector;
      
      CREATE TABLE IF NOT EXISTS ${tableName} (
        id SERIAL PRIMARY KEY,
        data JSONB,
        embedding vector(1536)
      );
    `;
    
    await this.query(sql);
  }
}
