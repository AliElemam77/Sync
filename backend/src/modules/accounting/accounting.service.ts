import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { ReverseTransactionDto } from './dto/reverse-transaction.dto';
import { QueryTransactionsDto } from './dto/query-transactions.dto';
import { FinancialSummaryQueryDto } from './dto/financial-summary-query.dto';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Prisma, TransactionType, TransactionCategory } from '@prisma/client';

@Injectable()
export class AccountingService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // 1. CREATE FINANCIAL TRANSACTION
  // ---------------------------------------------------------------------------

  async createTransaction(dto: CreateTransactionDto, user: AuthenticatedUser) {
    if (dto.amount <= 0) {
      throw new BadRequestException('مبلغ المعاملة يجب أن يكون أكبر من 0.');
    }

    const transactionDate = dto.transactionDate
      ? new Date(dto.transactionDate)
      : new Date();

    const decimalAmount = new Prisma.Decimal(dto.amount.toFixed(2));

    return this.prisma.financialTransaction.create({
      data: {
        amount: decimalAmount,
        type: dto.type,
        category: dto.category,
        paymentMethod: dto.paymentMethod,
        description: dto.description.trim(),
        transactionDate,
        referenceId: dto.referenceId?.trim() || null,
        referenceType: dto.referenceType?.trim() || null,
        attachmentUrl: dto.attachmentUrl?.trim() || null,
        recordedById: user.id,
      },
      include: {
        recordedBy: {
          select: {
            id: true,
            email: true,
            employeeProfile: {
              select: {
                fullName: true,
                employeeCode: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });
  }

  // ---------------------------------------------------------------------------
  // 2. REVERSE TRANSACTION (قيد عكسي تدقيقي - بدون حذف)
  // ---------------------------------------------------------------------------

  async reverseTransaction(
    id: string,
    dto: ReverseTransactionDto,
    user: AuthenticatedUser,
  ) {
    const original = await this.prisma.financialTransaction.findUnique({
      where: { id },
    });

    if (!original) {
      throw new NotFoundException(`القيد المالي ذو المعرف '${id}' غير موجود.`);
    }

    if (original.isReversed) {
      throw new BadRequestException('تم عكس وإلغاء هذا القيد المالي مسبقاً.');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Mark original as reversed
      const updatedOriginal = await tx.financialTransaction.update({
        where: { id },
        data: {
          isReversed: true,
          reversedAt: new Date(),
          reversalReason: dto.reason.trim(),
          reversedById: user.id,
        },
        include: {
          recordedBy: {
            select: {
              id: true,
              email: true,
              employeeProfile: { select: { fullName: true, employeeCode: true } },
            },
          },
          reversedBy: {
            select: {
              id: true,
              email: true,
              employeeProfile: { select: { fullName: true, employeeCode: true } },
            },
          },
        },
      });

      // 2. Insert corresponding opposing mirror entry to balance ledger
      const opposingType =
        original.type === TransactionType.INCOME
          ? TransactionType.EXPENSE
          : TransactionType.INCOME;

      await tx.financialTransaction.create({
        data: {
          amount: original.amount,
          type: opposingType,
          category: TransactionCategory.MISC,
          paymentMethod: original.paymentMethod,
          description: `[قيد تسوية عكسي] إلغاء قيد: ${original.description}`,
          transactionDate: new Date(),
          referenceId: original.id,
          referenceType: 'REVERSAL',
          recordedById: user.id,
        },
      });

      return updatedOriginal;
    });
  }

  // ---------------------------------------------------------------------------
  // 3. GET TRANSACTIONS (PAGINATED & FILTERED)
  // ---------------------------------------------------------------------------

  async getTransactions(query: QueryTransactionsDto) {
    const {
      search,
      type,
      category,
      paymentMethod,
      startDate,
      endDate,
      includeReversed = true,
      page = 1,
      limit = 20,
    } = query;

    const skip = (page - 1) * limit;
    const where: Prisma.FinancialTransactionWhereInput = {};

    if (type) {
      where.type = type;
    }

    if (category) {
      where.category = category;
    }

    if (paymentMethod) {
      where.paymentMethod = paymentMethod;
    }

    if (!includeReversed) {
      where.isReversed = false;
    }

    if (startDate || endDate) {
      where.transactionDate = {};
      if (startDate) {
        where.transactionDate.gte = new Date(startDate);
      }
      if (endDate) {
        where.transactionDate.lte = new Date(endDate);
      }
    }

    if (search && search.trim()) {
      const term = search.trim();
      where.OR = [
        { description: { contains: term, mode: 'insensitive' } },
        { referenceId: { contains: term, mode: 'insensitive' } },
        {
          recordedBy: {
            employeeProfile: {
              fullName: { contains: term, mode: 'insensitive' },
            },
          },
        },
      ];
    }

    const [transactions, total] = await Promise.all([
      this.prisma.financialTransaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { transactionDate: 'desc' },
        include: {
          recordedBy: {
            select: {
              id: true,
              email: true,
              employeeProfile: {
                select: {
                  fullName: true,
                  employeeCode: true,
                  avatarUrl: true,
                },
              },
            },
          },
          reversedBy: {
            select: {
              id: true,
              email: true,
              employeeProfile: {
                select: {
                  fullName: true,
                  employeeCode: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.financialTransaction.count({ where }),
    ]);

    return {
      data: transactions,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // 4. FINANCIAL SUMMARY & ANALYTICS (EXACT DECIMAL MATH)
  // ---------------------------------------------------------------------------

  async getFinancialSummary(query: FinancialSummaryQueryDto) {
    const currentYear = query.year || new Date().getFullYear();

    const startOfYear = new Date(currentYear, 0, 1);
    const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59, 999);

    const whereBase: Prisma.FinancialTransactionWhereInput = {
      isReversed: false,
      transactionDate: {
        gte: query.startDate ? new Date(query.startDate) : startOfYear,
        lte: query.endDate ? new Date(query.endDate) : endOfYear,
      },
    };

    // Calculate Totals using Database Aggregates
    const [incomeAggregate, expenseAggregate, allTransactions] =
      await Promise.all([
        this.prisma.financialTransaction.aggregate({
          where: { ...whereBase, type: TransactionType.INCOME },
          _sum: { amount: true },
        }),
        this.prisma.financialTransaction.aggregate({
          where: { ...whereBase, type: TransactionType.EXPENSE },
          _sum: { amount: true },
        }),
        this.prisma.financialTransaction.findMany({
          where: whereBase,
          select: {
            amount: true,
            type: true,
            category: true,
            transactionDate: true,
          },
        }),
      ]);

    const totalIncome = incomeAggregate._sum.amount
      ? Number(incomeAggregate._sum.amount)
      : 0;

    const totalExpense = expenseAggregate._sum.amount
      ? Number(expenseAggregate._sum.amount)
      : 0;

    const netProfit = Number((totalIncome - totalExpense).toFixed(2));
    const profitMargin =
      totalIncome > 0 ? Math.round((netProfit / totalIncome) * 100) : 0;

    // Breakdown by Category
    const incomeByCategory: Record<string, number> = {};
    const expenseByCategory: Record<string, number> = {};

    // 12 Months Trend Array for Recharts
    const months = [
      'يناير',
      'فبراير',
      'مارس',
      'أبريل',
      'مايو',
      'يونيو',
      'يوليو',
      'أغسطس',
      'سبتمبر',
      'أكتوبر',
      'نوفمبر',
      'ديسمبر',
    ];

    const monthlyTrend = months.map((monthName, idx) => ({
      month: monthName,
      monthIndex: idx,
      income: 0,
      expense: 0,
      net: 0,
    }));

    allTransactions.forEach((t) => {
      const numAmount = Number(t.amount);
      const tMonth = new Date(t.transactionDate).getMonth();

      if (t.type === TransactionType.INCOME) {
        incomeByCategory[t.category] = (incomeByCategory[t.category] || 0) + numAmount;
        if (monthlyTrend[tMonth]) {
          monthlyTrend[tMonth].income += numAmount;
        }
      } else {
        expenseByCategory[t.category] = (expenseByCategory[t.category] || 0) + numAmount;
        if (monthlyTrend[tMonth]) {
          monthlyTrend[tMonth].expense += numAmount;
        }
      }
    });

    // Compute net for each month
    monthlyTrend.forEach((m) => {
      m.net = Number((m.income - m.expense).toFixed(2));
    });

    return {
      year: currentYear,
      totalIncome,
      totalExpense,
      netProfit,
      profitMargin,
      incomeByCategory,
      expenseByCategory,
      monthlyTrend,
    };
  }

  // ---------------------------------------------------------------------------
  // 5. GET TRANSACTION BY ID
  // ---------------------------------------------------------------------------

  async getTransactionById(id: string) {
    const transaction = await this.prisma.financialTransaction.findUnique({
      where: { id },
      include: {
        recordedBy: {
          select: {
            id: true,
            email: true,
            employeeProfile: {
              select: {
                fullName: true,
                employeeCode: true,
                avatarUrl: true,
              },
            },
          },
        },
        reversedBy: {
          select: {
            id: true,
            email: true,
            employeeProfile: {
              select: {
                fullName: true,
                employeeCode: true,
              },
            },
          },
        },
      },
    });

    if (!transaction) {
      throw new NotFoundException(`القيد المالي ذو المعرف '${id}' غير موجود.`);
    }

    return transaction;
  }

  // ---------------------------------------------------------------------------
  // 6. AUTO-LOG ASSET PURCHASE EXPENSE
  // ---------------------------------------------------------------------------

  async logAssetPurchaseExpense(
    assetId: string,
    assetName: string,
    cost: number,
    userId: string,
  ) {
    if (!cost || cost <= 0) return null;

    return this.prisma.financialTransaction.create({
      data: {
        amount: new Prisma.Decimal(cost.toFixed(2)),
        type: TransactionType.EXPENSE,
        category: TransactionCategory.ASSET_PURCHASE,
        paymentMethod: 'BANK_TRANSFER',
        description: `شراء أصل تقني: ${assetName}`,
        transactionDate: new Date(),
        referenceId: assetId,
        referenceType: 'ASSET',
        recordedById: userId,
      },
    });
  }
}
