import { Injectable, Logger } from '@nestjs/common';
import { DocumentType } from '../../entities/financial-documents.entity';
import { DocumentParser, DocumentParserResult, DocumentParserOptions, ParsedTransaction } from '../interfaces/parser.interface';
import * as pdfParse from 'pdf-parse';
import * as fs from 'fs';
import * as path from 'path';
import * as moment from 'moment-timezone';

interface SaccoMembershipDetails {
  memberNumber: string;
  memberName: string;
  joinDate: Date;
  membershipStatus: string;
  branch?: string;
  lastContributionDate?: Date;
  totalShares?: number;
  monthlyContribution?: number;
}

interface SaccoLoanDetails {
  loanNumber: string;
  loanType: string;
  principalAmount: number;
  disbursementDate: Date;
  interestRate: number;
  term: number;
  outstandingBalance: number;
  status: string;
}

interface SaccoTransaction {
  date: Date;
  description: string;
  type: string;
  amount: number;
  balance: number;
  reference: string;
  category: string;
  shares?: number;
  interest?: number;
}

@Injectable()
export class SaccoParser implements DocumentParser {
  private readonly logger = new Logger(SaccoParser.name);
  private readonly supportedTypes = ['.pdf', '.csv'];

  // SACCO-specific transaction types
  private readonly transactionTypes = {
    'contribution': ['share contribution', 'monthly contribution', 'shares deposit'],
    'loan_disbursement': ['loan disbursed', 'loan amount', 'disbursement'],
    'loan_repayment': ['loan repayment', 'loan payment', 'repayment'],
    'dividend': ['dividend', 'profit share', 'annual return'],
    'withdrawal': ['withdrawal', 'shares withdrawal', 'partial withdrawal'],
    'fee': ['processing fee', 'service charge', 'membership fee'],
    'interest': ['interest earned', 'interest charged', 'interest payment']
  };

  canHandle(fileType: string, documentType: DocumentType): boolean {
    return this.supportedTypes.includes(path.extname(fileType).toLowerCase()) &&
           documentType === DocumentType.SACCO_STATEMENT;
  }

  async parse(filePath: string, options: DocumentParserOptions): Promise<DocumentParserResult> {
    try {
      this.logger.debug(`Starting SACCO statement parsing for file: ${filePath}`);
      const startTime = Date.now();

      let transactions: SaccoTransaction[] = [];
      let metadata: any = {};
      let membershipDetails: SaccoMembershipDetails | null = null;
      let loanDetails: SaccoLoanDetails[] = [];

      if (filePath.endsWith('.pdf')) {
        const result = await this.parsePdfStatement(filePath);
        transactions = result.transactions;
        metadata = result.metadata;
        membershipDetails = result.membershipDetails;
        loanDetails = result.loanDetails;
      } else if (filePath.endsWith('.csv')) {
        const result = await this.parseCsvStatement(filePath);
        transactions = result.transactions;
        metadata = result.metadata;
        membershipDetails = result.membershipDetails;
        loanDetails = result.loanDetails;
      }

      // Convert to standard transaction format
      const standardTransactions = this.convertToStandardFormat(transactions);

      // Calculate statistics
      const stats = this.calculateStatistics(transactions, membershipDetails, loanDetails);

      return {
        success: true,
        transactions: standardTransactions,
        metadata: {
          ...metadata,
          ...stats,
          membershipDetails,
          loanDetails,
          documentType: DocumentType.SACCO_STATEMENT,
          currency: 'KES',
          processingTime: Date.now() - startTime,
          confidence: this.calculateConfidence(standardTransactions, metadata, membershipDetails)
        }
      };
    } catch (error) {
      this.logger.error(`SACCO statement parsing failed: ${error.message}`, error.stack);
      return {
        success: false,
        error: {
          code: 'SACCO_PARSE_ERROR',
          message: error.message,
          details: error.stack
        }
      };
    }
  }

  async validateDocument(filePath: string): Promise<boolean> {
    try {
      if (filePath.endsWith('.pdf')) {
        const content = await this.extractTextFromPdf(filePath);
        return this.isValidSaccoStatement(content);
      } else if (filePath.endsWith('.csv')) {
        const content = fs.readFileSync(filePath, 'utf-8');
        return this.isValidSaccoCsv(content);
      }
      return false;
    } catch (error) {
      this.logger.error(`SACCO statement validation failed: ${error.message}`);
      return false;
    }
  }

  async extractMetadata(filePath: string): Promise<Record<string, any>> {
    try {
      if (filePath.endsWith('.pdf')) {
        const content = await this.extractTextFromPdf(filePath);
        return this.extractPdfMetadata(content);
      } else if (filePath.endsWith('.csv')) {
        const content = fs.readFileSync(filePath, 'utf-8');
        return this.extractCsvMetadata(content);
      }
      return {};
    } catch (error) {
      this.logger.error(`Metadata extraction failed: ${error.message}`);
      return {};
    }
  }

  private async parsePdfStatement(filePath: string): Promise<{
    transactions: SaccoTransaction[];
    metadata: any;
    membershipDetails: SaccoMembershipDetails;
    loanDetails: SaccoLoanDetails[];
  }> {
    const content = await this.extractTextFromPdf(filePath);
    const lines = content.split('\n');

    const membershipDetails = this.extractMembershipDetails(content);
    const loanDetails = this.extractLoanDetails(content);
    const metadata = this.extractPdfMetadata(content);
    const transactions: SaccoTransaction[] = [];

    let currentTransaction: Partial<SaccoTransaction> = {};
    const transactionPattern = /(\d{1,2}[-/.]\d{1,2}[-/.]\d{4})\s+(.+?)\s+(\d+)\s+(-?\d+(?:,\d{3})*(?:\.\d{2})?)\s+(-?\d+(?:,\d{3})*(?:\.\d{2})?)/i;

    for (const line of lines) {
      const match = line.match(transactionPattern);
      if (match) {
        if (Object.keys(currentTransaction).length > 0) {
          transactions.push(currentTransaction as SaccoTransaction);
          currentTransaction = {};
        }

        const [_, dateStr, description, reference, amountStr, balanceStr] = match;
        const amount = parseFloat(amountStr.replace(/,/g, ''));
        const balance = parseFloat(balanceStr.replace(/,/g, ''));

        currentTransaction = {
          date: this.parseDate(dateStr),
          description: description.trim(),
          type: this.determineTransactionType(description),
          amount,
          balance,
          reference,
          category: this.categorizeTransaction(description),
          ...this.extractTransactionDetails(description)
        };
      } else if (Object.keys(currentTransaction).length > 0) {
        // Additional transaction details in subsequent lines
        const details = this.extractAdditionalTransactionDetails(line);
        currentTransaction = { ...currentTransaction, ...details };
      }
    }

    // Add last transaction if exists
    if (Object.keys(currentTransaction).length > 0) {
      transactions.push(currentTransaction as SaccoTransaction);
    }

    return { transactions, metadata, membershipDetails, loanDetails };
  }

  private async parseCsvStatement(filePath: string): Promise<{
    transactions: SaccoTransaction[];
    metadata: any;
    membershipDetails: SaccoMembershipDetails;
    loanDetails: SaccoLoanDetails[];
  }> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

    const metadata = this.extractCsvMetadata(content);
    const membershipDetails = this.extractMembershipDetailsFromCsv(lines);
    const loanDetails = this.extractLoanDetailsFromCsv(lines);
    const transactions: SaccoTransaction[] = [];

    let transactionStartIndex = this.findTransactionStartIndex(lines);
    for (let i = transactionStartIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = line.split(',').map(v => v.trim());
      const record = headers.reduce((acc, header, index) => {
        acc[header] = values[index];
        return acc;
      }, {});

      const transaction: SaccoTransaction = {
        date: this.parseDate(record['date'] || record['transaction date']),
        description: record['description'] || record['details'] || record['narrative'],
        type: this.determineTransactionType(record['description'] || record['details']),
        amount: parseFloat((record['amount'] || '0').replace(/,/g, '')),
        balance: parseFloat((record['balance'] || '0').replace(/,/g, '')),
        reference: record['reference'] || record['transaction id'],
        category: this.categorizeTransaction(record['description'] || record['details']),
        shares: record['shares'] ? parseFloat(record['shares']) : undefined,
        interest: record['interest'] ? parseFloat(record['interest']) : undefined
      };

      transactions.push(transaction);
    }

    return { transactions, metadata, membershipDetails, loanDetails };
  }

  private async extractTextFromPdf(filePath: string): Promise<string> {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    return data.text;
  }

  private determineTransactionType(description: string): string {
    const desc = description.toLowerCase();
    
    for (const [type, patterns] of Object.entries(this.transactionTypes)) {
      if (patterns.some(pattern => desc.includes(pattern))) {
        return type.toUpperCase();
      }
    }

    return 'OTHER';
  }

  private categorizeTransaction(description: string): string {
    const desc = description.toLowerCase();

    if (desc.includes('loan')) {
      if (desc.includes('disbursed') || desc.includes('disbursement')) {
        return 'LOAN_DISBURSEMENT';
      } else if (desc.includes('repayment') || desc.includes('payment')) {
        return 'LOAN_REPAYMENT';
      }
      return 'LOAN_RELATED';
    } else if (desc.includes('contribution') || desc.includes('shares')) {
      return 'SHARES';
    } else if (desc.includes('dividend')) {
      return 'DIVIDEND';
    } else if (desc.includes('withdrawal')) {
      return 'WITHDRAWAL';
    } else if (desc.includes('fee') || desc.includes('charge')) {
      return 'FEE';
    } else if (desc.includes('interest')) {
      return 'INTEREST';
    }

    return 'OTHER';
  }

  private extractTransactionDetails(description: string): Partial<SaccoTransaction> {
    const details: Partial<SaccoTransaction> = {};
    
    // Extract shares amount if present
    const sharesMatch = description.match(/(\d+(?:,\d{3})*(?:\.\d{2})?)\s+shares/i);
    if (sharesMatch) {
      details.shares = parseFloat(sharesMatch[1].replace(/,/g, ''));
    }

    // Extract interest amount if present
    const interestMatch = description.match(/interest:?\s*(?:KES|Ksh)?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i);
    if (interestMatch) {
      details.interest = parseFloat(interestMatch[1].replace(/,/g, ''));
    }

    return details;
  }

  private extractAdditionalTransactionDetails(line: string): Partial<SaccoTransaction> {
    const details: Partial<SaccoTransaction> = {};
    
    // Extract additional shares information
    const sharesMatch = line.match(/shares:?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i);
    if (sharesMatch) {
      details.shares = parseFloat(sharesMatch[1].replace(/,/g, ''));
    }

    // Extract additional interest information
    const interestMatch = line.match(/interest:?\s*(?:KES|Ksh)?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i);
    if (interestMatch) {
      details.interest = parseFloat(interestMatch[1].replace(/,/g, ''));
    }

    return details;
  }

  private parseDate(dateStr: string): Date {
    const formats = [
      'DD/MM/YYYY',
      'DD-MM-YYYY',
      'YYYY-MM-DD',
      'DD.MM.YYYY',
      'DD MMM YYYY'
    ];

    for (const format of formats) {
      const parsed = moment(dateStr, format);
      if (parsed.isValid()) {
        return parsed.toDate();
      }
    }

    throw new Error(`Unable to parse date: ${dateStr}`);
  }

  private convertToStandardFormat(transactions: SaccoTransaction[]): ParsedTransaction[] {
    return transactions.map(t => ({
      transaction_date: t.date,
      description: t.description,
      amount: t.amount,
      balance_after: t.balance,
      transaction_type: t.type,
      category: t.category,
      reference: t.reference,
      metadata: {
        shares: t.shares,
        interest: t.interest
      }
    }));
  }

  private calculateStatistics(
    transactions: SaccoTransaction[],
    membershipDetails: SaccoMembershipDetails | null,
    loanDetails: SaccoLoanDetails[]
  ): any {
    const stats = {
      totalTransactions: transactions.length,
      totalContributions: 0,
      totalWithdrawals: 0,
      totalLoanDisbursements: 0,
      totalLoanRepayments: 0,
      totalDividends: 0,
      totalFees: 0,
      totalInterest: 0,
      transactionsByType: {},
      transactionsByCategory: {},
      averageMonthlyContribution: 0,
      totalShares: membershipDetails?.totalShares || 0,
      activeLoans: loanDetails.filter(l => l.status === 'ACTIVE').length,
      totalLoanBalance: loanDetails.reduce((sum, l) => sum + l.outstandingBalance, 0),
      membershipDuration: membershipDetails ? 
        moment().diff(moment(membershipDetails.joinDate), 'years', true) : 0,
      dateRange: {
        start: null as Date | null,
        end: null as Date | null
      }
    };

    if (transactions.length === 0) return stats;

    // Sort transactions by date
    const sortedTransactions = [...transactions].sort((a, b) => a.date.getTime() - b.date.getTime());
    stats.dateRange.start = sortedTransactions[0].date;
    stats.dateRange.end = sortedTransactions[sortedTransactions.length - 1].date;

    // Calculate totals and frequencies
    transactions.forEach(t => {
      // Update type frequencies
      stats.transactionsByType[t.type] = (stats.transactionsByType[t.type] || 0) + 1;
      stats.transactionsByCategory[t.category] = (stats.transactionsByCategory[t.category] || 0) + 1;

      // Update totals based on type
      switch (t.type) {
        case 'CONTRIBUTION':
          stats.totalContributions += t.amount;
          break;
        case 'WITHDRAWAL':
          stats.totalWithdrawals += Math.abs(t.amount);
          break;
        case 'LOAN_DISBURSEMENT':
          stats.totalLoanDisbursements += t.amount;
          break;
        case 'LOAN_REPAYMENT':
          stats.totalLoanRepayments += Math.abs(t.amount);
          break;
        case 'DIVIDEND':
          stats.totalDividends += t.amount;
          break;
        case 'FEE':
          stats.totalFees += Math.abs(t.amount);
          break;
        case 'INTEREST':
          stats.totalInterest += t.amount;
          break;
      }
    });

    // Calculate average monthly contribution
    if (stats.dateRange.start && stats.dateRange.end) {
      const monthsDiff = moment(stats.dateRange.end).diff(moment(stats.dateRange.start), 'months', true);
      if (monthsDiff > 0) {
        stats.averageMonthlyContribution = stats.totalContributions / monthsDiff;
      }
    }

    return stats;
  }

  private calculateConfidence(
    transactions: ParsedTransaction[],
    metadata: any,
    membershipDetails: SaccoMembershipDetails | null
  ): number {
    let score = 0;
    let totalChecks = 0;

    // Check for essential metadata
    if (metadata.dateRange?.start && metadata.dateRange?.end) { score++; }
    if (membershipDetails?.memberNumber) { score++; }
    if (membershipDetails?.memberName) { score++; }
    if (membershipDetails?.joinDate) { score++; }
    if (membershipDetails?.membershipStatus) { score++; }
    totalChecks += 5;

    // Check transactions
    if (transactions.length > 0) {
      score++;
      
      // Check transaction completeness
      const transactionChecks = transactions.every(t => 
        t.transaction_date && 
        t.description &&
        t.amount !== undefined &&
        t.balance_after !== undefined &&
        t.transaction_type &&
        t.reference
      );
      
      if (transactionChecks) score++;
      totalChecks += 2;

      // Check for SACCO-specific fields
      const saccoChecks = transactions.some(t =>
        t.metadata?.shares !== undefined || t.metadata?.interest !== undefined
      );

      if (saccoChecks) score++;
      totalChecks++;
    }

    return totalChecks > 0 ? score / totalChecks : 0;
  }

  private extractMembershipDetails(content: string): SaccoMembershipDetails {
    const membershipDetails: Partial<SaccoMembershipDetails> = {};

    // Extract member number
    const memberNumberMatch = content.match(/Member(?:\s+No\.?|Number):?\s*([A-Z0-9-]+)/i);
    if (memberNumberMatch) {
      membershipDetails.memberNumber = memberNumberMatch[1].trim();
    }

    // Extract member name
    const nameMatch = content.match(/Member(?:\s+Name)?:?\s*([A-Z\s]+)/i);
    if (nameMatch) {
      membershipDetails.memberName = nameMatch[1].trim();
    }

    // Extract join date
    const joinDateMatch = content.match(/Join(?:ed)?\s+Date:?\s*(\d{1,2}[-/.]\d{1,2}[-/.]\d{4})/i);
    if (joinDateMatch) {
      membershipDetails.joinDate = this.parseDate(joinDateMatch[1]);
    }

    // Extract membership status
    const statusMatch = content.match(/Status:?\s*(\w+)/i);
    if (statusMatch) {
      membershipDetails.membershipStatus = statusMatch[1].toUpperCase();
    }

    // Extract branch
    const branchMatch = content.match(/Branch:?\s*([A-Z\s]+)/i);
    if (branchMatch) {
      membershipDetails.branch = branchMatch[1].trim();
    }

    // Extract total shares
    const sharesMatch = content.match(/Total\s+Shares:?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i);
    if (sharesMatch) {
      membershipDetails.totalShares = parseFloat(sharesMatch[1].replace(/,/g, ''));
    }

    // Extract monthly contribution
    const contributionMatch = content.match(/Monthly\s+Contribution:?\s*(?:KES|Ksh)?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i);
    if (contributionMatch) {
      membershipDetails.monthlyContribution = parseFloat(contributionMatch[1].replace(/,/g, ''));
    }

    return membershipDetails as SaccoMembershipDetails;
  }

  private extractLoanDetails(content: string): SaccoLoanDetails[] {
    const loans: SaccoLoanDetails[] = [];
    const loanSections = content.split(/LOAN\s+DETAILS/i);

    for (let i = 1; i < loanSections.length; i++) {
      const section = loanSections[i];
      
      const loan: Partial<SaccoLoanDetails> = {};

      // Extract loan number
      const loanNumberMatch = section.match(/Loan\s+No\.?:?\s*([A-Z0-9-]+)/i);
      if (loanNumberMatch) {
        loan.loanNumber = loanNumberMatch[1].trim();
      }

      // Extract loan type
      const typeMatch = section.match(/Type:?\s*([A-Z\s]+)/i);
      if (typeMatch) {
        loan.loanType = typeMatch[1].trim();
      }

      // Extract principal amount
      const principalMatch = section.match(/Principal:?\s*(?:KES|Ksh)?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i);
      if (principalMatch) {
        loan.principalAmount = parseFloat(principalMatch[1].replace(/,/g, ''));
      }

      // Extract disbursement date
      const dateMatch = section.match(/Disbursement\s+Date:?\s*(\d{1,2}[-/.]\d{1,2}[-/.]\d{4})/i);
      if (dateMatch) {
        loan.disbursementDate = this.parseDate(dateMatch[1]);
      }

      // Extract interest rate
      const rateMatch = section.match(/Interest\s+Rate:?\s*(\d+(?:\.\d+)?)\s*%/i);
      if (rateMatch) {
        loan.interestRate = parseFloat(rateMatch[1]);
      }

      // Extract term
      const termMatch = section.match(/Term:?\s*(\d+)\s*(?:months|years)?/i);
      if (termMatch) {
        loan.term = parseInt(termMatch[1]);
      }

      // Extract outstanding balance
      const balanceMatch = section.match(/Outstanding\s+Balance:?\s*(?:KES|Ksh)?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i);
      if (balanceMatch) {
        loan.outstandingBalance = parseFloat(balanceMatch[1].replace(/,/g, ''));
      }

      // Extract status
      const statusMatch = section.match(/Status:?\s*(\w+)/i);
      if (statusMatch) {
        loan.status = statusMatch[1].toUpperCase();
      }

      if (loan.loanNumber) {
        loans.push(loan as SaccoLoanDetails);
      }
    }

    return loans;
  }

  private isValidSaccoStatement(content: string): boolean {
    const saccoIdentifiers = [
      'SACCO',
      'Member',
      'Shares',
      'Contribution',
      'Dividend',
      'Statement'
    ];

    const contentLower = content.toLowerCase();
    return saccoIdentifiers.some(id => contentLower.includes(id.toLowerCase()));
  }

  private isValidSaccoCsv(content: string): boolean {
    const requiredHeaders = [
      'date',
      'description',
      'amount',
      'balance',
      'reference'
    ];

    const headers = content.split('\n')[0].toLowerCase();
    return requiredHeaders.every(header => headers.includes(header));
  }

  private extractPdfMetadata(content: string): any {
    return {
      statementType: 'SACCO_STATEMENT',
      ...this.extractMembershipDetails(content)
    };
  }

  private extractCsvMetadata(content: string): any {
    return {
      statementType: 'SACCO_STATEMENT',
      format: 'CSV'
    };
  }

  private extractMembershipDetailsFromCsv(lines: string[]): SaccoMembershipDetails {
    const membershipDetails: Partial<SaccoMembershipDetails> = {};

    // Look for membership details in header section
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      const line = lines[i].toLowerCase();

      if (line.includes('member no') || line.includes('member number')) {
        const match = line.match(/:\s*([A-Z0-9-]+)/i);
        if (match) membershipDetails.memberNumber = match[1].trim();
      }

      if (line.includes('member name')) {
        const match = line.match(/:\s*([A-Z\s]+)/i);
        if (match) membershipDetails.memberName = match[1].trim();
      }

      if (line.includes('join date')) {
        const match = line.match(/:\s*(\d{1,2}[-/.]\d{1,2}[-/.]\d{4})/);
        if (match) membershipDetails.joinDate = this.parseDate(match[1]);
      }

      if (line.includes('status')) {
        const match = line.match(/:\s*(\w+)/i);
        if (match) membershipDetails.membershipStatus = match[1].toUpperCase();
      }
    }

    return membershipDetails as SaccoMembershipDetails;
  }

  private extractLoanDetailsFromCsv(lines: string[]): SaccoLoanDetails[] {
    const loans: SaccoLoanDetails[] = [];
    let inLoanSection = false;
    let currentLoan: Partial<SaccoLoanDetails> = {};

    for (const line of lines) {
      if (line.toLowerCase().includes('loan details')) {
        inLoanSection = true;
        currentLoan = {};
        continue;
      }

      if (!inLoanSection) continue;

      if (line.trim() === '') {
        if (Object.keys(currentLoan).length > 0) {
          loans.push(currentLoan as SaccoLoanDetails);
          currentLoan = {};
        }
        inLoanSection = false;
        continue;
      }

      const [key, value] = line.split(',').map(s => s.trim());
      if (!key || !value) continue;

      switch (key.toLowerCase()) {
        case 'loan no':
        case 'loan number':
          currentLoan.loanNumber = value;
          break;
        case 'loan type':
          currentLoan.loanType = value;
          break;
        case 'principal':
          currentLoan.principalAmount = parseFloat(value.replace(/[^0-9.-]/g, ''));
          break;
        case 'disbursement date':
          currentLoan.disbursementDate = this.parseDate(value);
          break;
        case 'interest rate':
          currentLoan.interestRate = parseFloat(value.replace(/[^0-9.-]/g, ''));
          break;
        case 'term':
          currentLoan.term = parseInt(value);
          break;
        case 'outstanding balance':
          currentLoan.outstandingBalance = parseFloat(value.replace(/[^0-9.-]/g, ''));
          break;
        case 'status':
          currentLoan.status = value.toUpperCase();
          break;
      }
    }

    if (Object.keys(currentLoan).length > 0) {
      loans.push(currentLoan as SaccoLoanDetails);
    }

    return loans;
  }

  private findTransactionStartIndex(lines: string[]): number {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      if (line.includes('transaction details') || 
          line.includes('statement details') ||
          line.includes('date,description,amount,balance')) {
        return i + 1;
      }
    }
    return 0;
  }
}
