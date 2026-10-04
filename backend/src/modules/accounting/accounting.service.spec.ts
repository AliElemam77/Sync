import { BadRequestException } from '@nestjs/common';
import { Prisma, TransactionCategory, TransactionType } from '@prisma/client';
import { AccountingService } from './accounting.service';

const user = {
  id: 'acc-user',
  email: 'accountant@example.com',
  roleId: 'role-acc',
  role: 'ACCOUNTANT',
  permissions: [],
  employeeId: 'acc-emp',
  departmentId: 'dept-fin',
  isManagement: false,
};

describe('AccountingService reversals', () => {
  let prisma: any;
  let service: AccountingService;

  const original = {
    id: 'tx-1',
    amount: new Prisma.Decimal(1000),
    type: TransactionType.INCOME,
    category: TransactionCategory.CLIENT_PAYMENT,
    paymentMethod: 'BANK_TRANSFER',
    description: 'Client payment',
    isReversed: false,
  };

  beforeEach(() => {
    prisma = {
      financialTransaction: {
        findUnique: jest.fn().mockResolvedValue(original),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ ...original, isReversed: true }),
        create: jest.fn(),
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null } }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(prisma)),
    };
    service = new AccountingService(prisma);
  });

  it('records an opposite mirror entry dated today', async () => {
    await service.reverseTransaction('tx-1', { reason: 'Entered twice' }, user);

    expect(prisma.financialTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amount: original.amount,
        type: TransactionType.EXPENSE,
        referenceId: 'tx-1',
        referenceType: 'REVERSAL',
      }),
    });
  });

  it('does not record a second mirror when another reversal won the race', async () => {
    prisma.financialTransaction.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.reverseTransaction('tx-1', { reason: 'Entered twice' }, user),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.financialTransaction.create).not.toHaveBeenCalled();
  });

  it('keeps reversed entries in the summary so the mirror entry offsets them', async () => {
    await service.getFinancialSummary({ year: 2026 });

    for (const [args] of prisma.financialTransaction.aggregate.mock.calls) {
      expect(args.where).not.toHaveProperty('isReversed');
    }
    expect(prisma.financialTransaction.findMany.mock.calls[0][0].where).not.toHaveProperty(
      'isReversed',
    );
  });
});
