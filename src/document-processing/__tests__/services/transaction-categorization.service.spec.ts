import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TransactionCategorizationService } from '../../services/transaction-categorization.service';
import { TransactionHistory } from '../../../entities/transaction-history.entity';

describe('TransactionCategorizationService', () => {
  let service: TransactionCategorizationService;
  let repository: Repository<TransactionHistory>;

  const mockRepository = {
    save: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([])
    }))
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionCategorizationService,
        {
          provide: getRepositoryToken(TransactionHistory),
          useValue: mockRepository
        }
      ],
    }).compile();

    service = module.get<TransactionCategorizationService>(TransactionCategorizationService);
    repository = module.get<Repository<TransactionHistory>>(getRepositoryToken(TransactionHistory));
  });

  describe('categorizeTransaction', () => {
    it('should categorize salary transactions', () => {
      const result = service.categorizeTransaction('SALARY PAYMENT FROM COMPANY XYZ');
      expect(result.category).toBe('INCOME');
      expect(result.subcategory).toBe('SALARY');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should categorize M-Pesa transactions', () => {
      const result = service.categorizeTransaction('M-PESA PAYMENT TO SAFARICOM');
      expect(result.category).toBe('MOBILE_MONEY');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should categorize utility bill payments', () => {
      const result = service.categorizeTransaction('KPLC PREPAID TOKEN PURCHASE');
      expect(result.category).toBe('BILLS');
      expect(result.subcategory).toBe('ELECTRICITY');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should categorize unknown transactions as UNCATEGORIZED', () => {
      const result = service.categorizeTransaction('XYZABC123');
      expect(result.category).toBe('UNCATEGORIZED');
      expect(result.confidence).toBeLessThan(0.5);
    });

    it('should adjust confidence based on amount', () => {
      const result = service.categorizeTransaction('Payment', 100000);
      expect(result.category).toBe('HIGH_VALUE_TRANSACTION');
      expect(result.confidence).toBeGreaterThan(0);
    });
  });

  describe('categorizeBatch', () => {
    const mockTransactions = [
      {
        transaction_id: 1,
        description: 'SALARY PAYMENT',
        amount: 50000,
        transaction_date: new Date()
      },
      {
        transaction_id: 2,
        description: 'M-PESA PAYMENT',
        amount: 1000,
        transaction_date: new Date()
      }
    ];

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should categorize multiple transactions', async () => {
      mockRepository.save.mockResolvedValue(mockTransactions);

      const result = await service.categorizeBatch(mockTransactions as TransactionHistory[]);

      expect(result).toHaveLength(2);
      expect(mockRepository.save).toHaveBeenCalled();

      expect(result[0].category).toBe('INCOME');
      expect(result[1].category).toBe('MOBILE_MONEY');
    });

    it('should handle empty transaction list', async () => {
      const result = await service.categorizeBatch([]);
      expect(result).toHaveLength(0);
      expect(mockRepository.save).toHaveBeenCalledWith([]);
    });

    it('should preserve original transaction data', async () => {
      mockRepository.save.mockImplementation(data => data);

      const result = await service.categorizeBatch(mockTransactions as TransactionHistory[]);

      expect(result[0].transaction_id).toBe(1);
      expect(result[0].amount).toBe(50000);
      expect(result[1].transaction_id).toBe(2);
      expect(result[1].amount).toBe(1000);
    });
  });

  describe('recategorizeHistorical', () => {
    const mockTransactions = [
      {
        transaction_id: 1,
        description: 'OLD UNCATEGORIZED TRANSACTION',
        amount: 1000,
        transaction_date: new Date('2023-01-01')
      }
    ];

    beforeEach(() => {
      jest.clearAllMocks();
      mockRepository.createQueryBuilder().getMany.mockResolvedValue(mockTransactions);
    });

    it('should recategorize transactions within date range', async () => {
      const startDate = new Date('2023-01-01');
      const endDate = new Date('2023-12-31');

      await service.recategorizeHistorical(startDate, endDate);

      expect(mockRepository.createQueryBuilder).toHaveBeenCalled();
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should apply minimum confidence filter', async () => {
      await service.recategorizeHistorical(undefined, undefined, 0.8);

      expect(mockRepository.createQueryBuilder().andWhere)
        .toHaveBeenCalledWith(
          "(transaction.metadata->>'categorization.confidence')::float < :minConfidence",
          { minConfidence: 0.8 }
        );
    });
  });

  describe('Category Rules', () => {
    it('should add new category rule', () => {
      const newRule = {
        name: 'TEST_CATEGORY',
        patterns: [
          {
            pattern: /test/i,
            category: 'TEST',
            confidence: 0.9
          }
        ]
      };

      service.addCategoryRule(newRule);

      const result = service.categorizeTransaction('test transaction');
      expect(result.category).toBe('TEST');
      expect(result.confidence).toBe(0.9);
    });

    it('should update existing category rule', () => {
      const ruleName = 'INCOME';
      const updates = {
        patterns: [
          {
            pattern: /new salary pattern/i,
            category: 'INCOME',
            subcategory: 'SALARY',
            confidence: 0.95
          }
        ]
      };

      service.updateCategoryRule(ruleName, updates);

      const result = service.categorizeTransaction('new salary pattern');
      expect(result.category).toBe('INCOME');
      expect(result.subcategory).toBe('SALARY');
      expect(result.confidence).toBe(0.95);
    });

    it('should remove category rule', () => {
      const testRule = {
        name: 'TEST_RULE',
        patterns: [
          {
            pattern: /test/i,
            category: 'TEST',
            confidence: 0.9
          }
        ]
      };

      service.addCategoryRule(testRule);
      service.removeCategoryRule('TEST_RULE');

      const result = service.categorizeTransaction('test transaction');
      expect(result.category).not.toBe('TEST');
    });

    it('should throw error when adding duplicate rule', () => {
      const rule = {
        name: 'DUPLICATE_RULE',
        patterns: [
          {
            pattern: /test/i,
            category: 'TEST',
            confidence: 0.9
          }
        ]
      };

      service.addCategoryRule(rule);

      expect(() => service.addCategoryRule(rule))
        .toThrow('Category rule \'DUPLICATE_RULE\' already exists');
    });

    it('should throw error when updating non-existent rule', () => {
      expect(() => service.updateCategoryRule('NON_EXISTENT', {}))
        .toThrow('Category rule \'NON_EXISTENT\' not found');
    });

    it('should throw error when removing non-existent rule', () => {
      expect(() => service.removeCategoryRule('NON_EXISTENT'))
        .toThrow('Category rule \'NON_EXISTENT\' not found');
    });
  });

  describe('Transaction Statistics', () => {
    const mockTransactions = [
      {
        category: 'INCOME',
        amount: 50000,
        transaction_date: new Date('2023-01-01')
      },
      {
        category: 'BILLS',
        amount: 5000,
        transaction_date: new Date('2023-01-15')
      },
      {
        category: 'BILLS',
        amount: 3000,
        transaction_date: new Date('2023-01-20')
      }
    ];

    beforeEach(() => {
      jest.clearAllMocks();
      mockRepository.createQueryBuilder().getMany.mockResolvedValue(mockTransactions);
    });

    it('should calculate transaction statistics by category', async () => {
      const startDate = new Date('2023-01-01');
      const endDate = new Date('2023-01-31');

      const stats = await service.getTransactionStats(startDate, endDate);

      expect(stats).toHaveProperty('INCOME');
      expect(stats).toHaveProperty('BILLS');

      expect(stats.INCOME).toEqual({
        count: 1,
        total: 50000,
        average: 50000
      });

      expect(stats.BILLS).toEqual({
        count: 2,
        total: 8000,
        average: 4000
      });
    });

    it('should handle empty transaction list', async () => {
      mockRepository.createQueryBuilder().getMany.mockResolvedValue([]);

      const stats = await service.getTransactionStats(new Date(), new Date());
      expect(Object.keys(stats)).toHaveLength(0);
    });

    it('should handle uncategorized transactions', async () => {
      mockRepository.createQueryBuilder().getMany.mockResolvedValue([
        {
          amount: 1000,
          transaction_date: new Date()
        }
      ]);

      const stats = await service.getTransactionStats(new Date(), new Date());
      expect(stats).toHaveProperty('UNCATEGORIZED');
      expect(stats.UNCATEGORIZED.count).toBe(1);
    });
  });
});
