import { registerAs } from '@nestjs/config';

export const databaseConfig = registerAs('database', () => ({
  type: process.env.DATABASE_TYPE || 'postgres',
  postgres: {
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    username: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB,
    ssl: process.env.NODE_ENV === 'production' ? (() => {
      try {
        return {
          rejectUnauthorized: false,
          ca: require('fs').readFileSync('./rds-ca-rsa2048-g1.pem').toString()
        };
      } catch (error) {
        console.log('RDS CA certificate not found, using SSL without CA verification');
        return {
          rejectUnauthorized: false
        };
      }
    })() : false,
  },
  oracle: {
    host: process.env.ORACLE_HOST,
    port: parseInt(process.env.ORACLE_PORT || '1521', 10),
    username: process.env.ORACLE_USER,
    password: process.env.ORACLE_PASSWORD,
    sid: process.env.ORACLE_SID,
    serviceName: process.env.ORACLE_SERVICE_NAME,
  },
  synchronize: process.env.NODE_ENV !== 'production',
  logging: process.env.NODE_ENV !== 'production',
}));



