import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TransactionHistory } from '../../entities/transaction-history.entity';

export interface TransactionPattern {
  pattern: RegExp;
  category: string;
  subcategory?: string;
  confidence: number;
  metadata?: Record<string, any>;
}

export interface CategoryRule {
  name: string;
  patterns: TransactionPattern[];
  metadata?: Record<string, any>;
}

export interface CategorizationResult {
  category: string;
  subcategory?: string;
  confidence: number;
  metadata?: Record<string, any>;
  rule?: string;
  pattern?: string;
}

@Injectable()
export class TransactionCategorizationService {
  private readonly logger = new Logger(TransactionCategorizationService.name);

  // Kenyan-specific transaction categories and patterns
  private readonly categoryRules: CategoryRule[] = [
    {
      name: 'INCOME',
      patterns: [
        {
          pattern: /salary|payroll|wages/i,
          category: 'INCOME',
          subcategory: 'SALARY',
          confidence: 0.9
        },
        {
          pattern: /dividend|profit share|return on investment/i,
          category: 'INCOME',
          subcategory: 'INVESTMENT',
          confidence: 0.85
        },
        {
          pattern: /rent(?:\s+received|\s+income)?|lease payment/i,
          category: 'INCOME',
          subcategory: 'RENTAL',
          confidence: 0.8
        },
        {
          pattern: /business income|sales revenue|commission/i,
          category: 'INCOME',
          subcategory: 'BUSINESS',
          confidence: 0.85
        }
      ]
    },
    {
      name: 'MOBILE_MONEY',
      patterns: [
        {
          pattern: /m-pesa|mpesa|airtel money|t-kash/i,
          category: 'MOBILE_MONEY',
          confidence: 0.95,
          metadata: { provider: 'mpesa' }
        },
        {
          pattern: /(?:sent|transfer(?:red)?)\s+to\s+(?:\+254|0)?7\d{8}/i,
          category: 'MOBILE_MONEY',
          subcategory: 'SEND',
          confidence: 0.9
        },
        {
          pattern: /(?:received|transfer(?:red)?)\s+from\s+(?:\+254|0)?7\d{8}/i,
          category: 'MOBILE_MONEY',
          subcategory: 'RECEIVE',
          confidence: 0.9
        }
      ]
    },
    {
      name: 'BILLS',
      patterns: [
        {
          pattern: /kplc|kenya power|token|electricity/i,
          category: 'BILLS',
          subcategory: 'ELECTRICITY',
          confidence: 0.9,
          metadata: { provider: 'kplc' }
        },
        {
          pattern: /water bill|nairobi water|maji/i,
          category: 'BILLS',
          subcategory: 'WATER',
          confidence: 0.85
        },
        {
          pattern: /dstv|gotv|zuku|netflix|showmax/i,
          category: 'BILLS',
          subcategory: 'ENTERTAINMENT',
          confidence: 0.9
        },
        {
          pattern: /wifi|internet|safaricom home|zuku fiber/i,
          category: 'BILLS',
          subcategory: 'INTERNET',
          confidence: 0.85
        }
      ]
    },
    {
      name: 'TRANSPORT',
      patterns: [
        {
          pattern: /matatu|bus fare|public transport/i,
          category: 'TRANSPORT',
          subcategory: 'PUBLIC',
          confidence: 0.8
        },
        {
          pattern: /uber|bolt|little cab|taxi/i,
          category: 'TRANSPORT',
          subcategory: 'RIDE_HAILING',
          confidence: 0.9
        },
        {
          pattern: /fuel|petrol|diesel|shell|total|kenol/i,
          category: 'TRANSPORT',
          subcategory: 'FUEL',
          confidence: 0.85
        }
      ]
    },
    {
      name: 'SHOPPING',
      patterns: [
        {
          pattern: /naivas|carrefour|quickmart|tuskys|nakumatt/i,
          category: 'SHOPPING',
          subcategory: 'SUPERMARKET',
          confidence: 0.95
        },
        {
          pattern: /jumia|kilimall|amazon|alibaba|jiji/i,
          category: 'SHOPPING',
          subcategory: 'ONLINE',
          confidence: 0.9
        },
        {
          pattern: /market|grocery|mboga|fruits|vegetables/i,
          category: 'SHOPPING',
          subcategory: 'GROCERIES',
          confidence: 0.8
        }
      ]
    },
    {
      name: 'EDUCATION',
      patterns: [
        {
          pattern: /school fees|tuition|college fees|university/i,
          category: 'EDUCATION',
          subcategory: 'TUITION',
          confidence: 0.9
        },
        {
          pattern: /books|stationery|uniform|school supplies/i,
          category: 'EDUCATION',
          subcategory: 'SUPPLIES',
          confidence: 0.85
        }
      ]
    },
    {
      name: 'HEALTHCARE',
      patterns: [
        {
          pattern: /hospital|clinic|doctor|medical|nhif/i,
          category: 'HEALTHCARE',
          subcategory: 'MEDICAL',
          confidence: 0.9
        },
        {
          pattern: /pharmacy|medicine|prescription|drugs/i,
          category: 'HEALTHCARE',
          subcategory: 'PHARMACY',
          confidence: 0.85
        },
        {
          pattern: /insurance|britam|jubilee|apa|cic/i,
          category: 'HEALTHCARE',
          subcategory: 'INSURANCE',
          confidence: 0.9
        }
      ]
    },
    {
      name: 'LOANS',
      patterns: [
        {
          pattern: /loan disbursement|loan amount|borrowed/i,
          category: 'LOANS',
          subcategory: 'DISBURSEMENT',
          confidence: 0.9
        },
        {
          pattern: /loan repayment|loan payment|repaid/i,
          category: 'LOANS',
          subcategory: 'REPAYMENT',
          confidence: 0.9
        },
        {
          pattern: /mshwari|kcb mpesa|fuliza|tala|branch/i,
          category: 'LOANS',
          subcategory: 'DIGITAL',
          confidence: 0.95
        }
      ]
    },
    {
      name: 'SAVINGS',
      patterns: [
        {
          pattern: /savings deposit|save|investment deposit/i,
          category: 'SAVINGS',
          subcategory: 'DEPOSIT',
          confidence: 0.9
        },
        {
          pattern: /sacco contribution|shares purchase/i,
          category: 'SAVINGS',
          subcategory: 'SACCO',
          confidence: 0.95
        },
        {
          pattern: /fixed deposit|term deposit/i,
          category: 'SAVINGS',
          subcategory: 'FIXED_DEPOSIT',
          confidence: 0.9
        }
      ]
    }
  ];

  constructor(
    @InjectRepository(TransactionHistory)
    private readonly transactionRepository: Repository<TransactionHistory>
  ) {}

  /**
   * Categorize a single transaction based on its description
   */
  categorizeTransaction(description: string, amount?: number): CategorizationResult {
    let bestMatch: CategorizationResult = {
      category: 'UNCATEGORIZED',
      confidence: 0
    };

    for (const rule of this.categoryRules) {
      for (const pattern of rule.patterns) {
        if (pattern.pattern.test(description)) {
          // If we find a match with higher confidence, update bestMatch
          if (pattern.confidence > bestMatch.confidence) {
            bestMatch = {
              category: pattern.category,
              subcategory: pattern.subcategory,
              confidence: pattern.confidence,
              metadata: { ...rule.metadata, ...pattern.metadata },
              rule: rule.name,
              pattern: pattern.pattern.source
            };
          }
        }
      }
    }

    // Apply amount-based adjustments
    if (amount !== undefined) {
      bestMatch = this.adjustCategoryByAmount(bestMatch, amount);
    }

    return bestMatch;
  }

  /**
   * Batch categorize multiple transactions
   */
  async categorizeBatch(transactions: TransactionHistory[]): Promise<TransactionHistory[]> {
    const categorizedTransactions = transactions.map(transaction => {
      const result = this.categorizeTransaction(transaction.description, transaction.amount);
      
      return {
        ...transaction,
        category: result.category,
        subcategory: result.subcategory,
        metadata: {
          ...transaction.metadata,
          categorization: {
            confidence: result.confidence,
            rule: result.rule,
            pattern: result.pattern
          }
        }
      };
    });

    // Save categorized transactions
    return await this.transactionRepository.save(categorizedTransactions);
  }

  /**
   * Recategorize historical transactions
   */
  async recategorizeHistorical(
    startDate?: Date,
    endDate?: Date,
    minConfidence?: number
  ): Promise<void> {
    const query = this.transactionRepository.createQueryBuilder('transaction');

    if (startDate) {
      query.andWhere('transaction.transaction_date >= :startDate', { startDate });
    }
    if (endDate) {
      query.andWhere('transaction.transaction_date <= :endDate', { endDate });
    }
    if (minConfidence) {
      query.andWhere("(transaction.metadata->>'categorization.confidence')::float < :minConfidence", { minConfidence });
    }

    const transactions = await query.getMany();
    await this.categorizeBatch(transactions);
  }

  /**
   * Add a new categorization rule
   */
  addCategoryRule(rule: CategoryRule): void {
    // Validate rule
    if (!rule.name || !rule.patterns || rule.patterns.length === 0) {
      throw new Error('Invalid category rule');
    }

    // Check for duplicate rule name
    if (this.categoryRules.some(r => r.name === rule.name)) {
      throw new Error(`Category rule '${rule.name}' already exists`);
    }

    // Add the rule
    this.categoryRules.push(rule);
    this.logger.log(`Added new category rule: ${rule.name}`);
  }

  /**
   * Update an existing categorization rule
   */
  updateCategoryRule(ruleName: string, updates: Partial<CategoryRule>): void {
    const ruleIndex = this.categoryRules.findIndex(r => r.name === ruleName);
    if (ruleIndex === -1) {
      throw new Error(`Category rule '${ruleName}' not found`);
    }

    this.categoryRules[ruleIndex] = {
      ...this.categoryRules[ruleIndex],
      ...updates,
      name: ruleName // Prevent name changes
    };

    this.logger.log(`Updated category rule: ${ruleName}`);
  }

  /**
   * Remove a categorization rule
   */
  removeCategoryRule(ruleName: string): void {
    const initialLength = this.categoryRules.length;
    this.categoryRules = this.categoryRules.filter(r => r.name !== ruleName);

    if (this.categoryRules.length === initialLength) {
      throw new Error(`Category rule '${ruleName}' not found`);
    }

    this.logger.log(`Removed category rule: ${ruleName}`);
  }

  /**
   * Get transaction statistics by category
   */
  async getTransactionStats(
    startDate: Date,
    endDate: Date
  ): Promise<Record<string, { count: number; total: number; average: number }>> {
    const transactions = await this.transactionRepository
      .createQueryBuilder('transaction')
      .where('transaction.transaction_date BETWEEN :startDate AND :endDate', { startDate, endDate })
      .getMany();

    const stats: Record<string, { count: number; total: number; average: number }> = {};

    transactions.forEach(transaction => {
      const category = transaction.category || 'UNCATEGORIZED';
      
      if (!stats[category]) {
        stats[category] = { count: 0, total: 0, average: 0 };
      }

      stats[category].count++;
      stats[category].total += Math.abs(transaction.amount);
      stats[category].average = stats[category].total / stats[category].count;
    });

    return stats;
  }

  /**
   * Adjust category based on transaction amount
   */
  private adjustCategoryByAmount(
    result: CategorizationResult,
    amount: number
  ): CategorizationResult {
    // Example adjustments based on amount
    if (Math.abs(amount) > 100000) {
      // Large transactions might be loans or investments
      if (result.confidence < 0.9) {
        return {
          ...result,
          category: 'HIGH_VALUE_TRANSACTION',
          confidence: Math.min(result.confidence + 0.1, 1)
        };
      }
    }

    if (Math.abs(amount) < 100) {
      // Very small transactions might be mobile money or transport
      if (result.category === 'UNCATEGORIZED') {
        return {
          ...result,
          category: 'SMALL_TRANSACTION',
          confidence: Math.min(result.confidence + 0.1, 1)
        };
      }
    }

    return result;
  }

  /**
   * Get all available categories and their patterns
   */
  getCategoryRules(): CategoryRule[] {
    return this.categoryRules;
  }

  /**
   * Get category rule by name
   */
  getCategoryRule(ruleName: string): CategoryRule | undefined {
    return this.categoryRules.find(r => r.name === ruleName);
  }
}
