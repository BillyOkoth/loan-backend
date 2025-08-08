import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  constructor(private readonly metricsService: MetricsService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();

    // Override res.end to capture response status and duration
    const originalEnd = res.end;
    res.end = function(chunk?: any, encoding?: any) {
      const duration = (Date.now() - startTime) / 1000; // Convert to seconds
      const method = req.method;
      const route = req.route?.path || req.path;
      const status = res.statusCode;

      // Record metrics
      this.metricsService.recordHttpRequest(method, route, status, duration);

      // Call original end method
      originalEnd.call(this, chunk, encoding);
    }.bind({ metricsService: this.metricsService });

    next();
  }
}
