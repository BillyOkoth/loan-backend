import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

// Polyfill for crypto module in environments where it's not available
if (typeof globalThis.crypto === 'undefined') {
  try {
    // Try Node.js built-in crypto first
    const { webcrypto } = require('crypto');
    globalThis.crypto = webcrypto;
  } catch (error) {
    try {
      // Fallback to crypto-browserify if Node.js crypto is not available
      globalThis.crypto = require('crypto-browserify');
    } catch (fallbackError) {
      // Last resort: create a minimal crypto polyfill
      console.warn('Warning: crypto module not available, using minimal polyfill');
      (globalThis as any).crypto = {
        getRandomValues: (arr: any) => {
          for (let i = 0; i < arr.length; i++) {
            arr[i] = Math.floor(Math.random() * 256);
          }
          return arr;
        },
        randomUUID: () => {
          return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
          });
        }
      };
    }
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  const config = new DocumentBuilder()
  .setTitle('Loan App API')
  .setDescription('API for managing loans and recommendations')
  .setVersion('1.0')
  .build();

const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup('api', app, document);
  await app.listen(3000);
}
bootstrap();
