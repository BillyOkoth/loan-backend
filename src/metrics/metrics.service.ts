import { Injectable } from '@nestjs/common';
import { register, collectDefaultMetrics, Counter, Histogram, Gauge } from 'prom-client';

@Injectable()
export class MetricsService {
  private httpRequestsTotal: Counter;
  private httpRequestDuration: Histogram;
  private activeConnections: Gauge;
  private loanApplicationsTotal: Counter;
  private customerRegistrationsTotal: Counter;

  constructor() {
    // Enable default metrics (CPU, memory, etc.)
    collectDefaultMetrics();

    // HTTP request counter
    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status'],
    });

    // HTTP request duration histogram
    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route'],
      buckets: [0.1, 0.5, 1, 2, 5],
    });

    // Active connections gauge
    this.activeConnections = new Gauge({
      name: 'active_connections',
      help: 'Number of active connections',
    });

    // Loan applications counter
    this.loanApplicationsTotal = new Counter({
      name: 'loan_applications_total',
      help: 'Total number of loan applications',
      labelNames: ['status'],
    });

    // Customer registrations counter
    this.customerRegistrationsTotal = new Counter({
      name: 'customer_registrations_total',
      help: 'Total number of customer registrations',
    });
  }

  // Record HTTP request
  recordHttpRequest(method: string, route: string, status: number, duration: number) {
    this.httpRequestsTotal.inc({ method, route, status });
    this.httpRequestDuration.observe({ method, route }, duration);
  }

  // Update active connections
  setActiveConnections(count: number) {
    this.activeConnections.set(count);
  }

  // Record loan application
  recordLoanApplication(status: string) {
    this.loanApplicationsTotal.inc({ status });
  }

  // Record customer registration
  recordCustomerRegistration() {
    this.customerRegistrationsTotal.inc();
  }

  // Get metrics as string
  async getMetrics(): Promise<string> {
    return await register.metrics();
  }
}
