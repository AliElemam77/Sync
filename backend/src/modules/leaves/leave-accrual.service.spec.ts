import { LeaveAccrualService } from './leave-accrual.service';

describe('LeaveAccrualService.accrueDueLeave', () => {
  let prisma: any;
  let service: LeaveAccrualService;

  beforeEach(() => {
    prisma = {
      employeeProfile: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    service = new LeaveAccrualService(prisma);
  });

  // 15 October 2026 in Cairo
  const now = new Date('2026-10-15T09:00:00Z');
  const october = new Date('2026-10-01T00:00:00Z');

  it('credits 1.75 days for every month since the last accrual and moves the marker', async () => {
    prisma.employeeProfile.findMany.mockResolvedValue([
      { id: 'emp-1', leaveAccruedThrough: new Date('2026-08-01T00:00:00Z') },
    ]);

    await expect(service.accrueDueLeave(now)).resolves.toBe(1);

    const creditCall = prisma.employeeProfile.updateMany.mock.calls.find(
      ([arg]: [{ where: { id?: string } }]) => arg.where.id === 'emp-1',
    );
    expect(creditCall[0].where).toEqual({
      id: 'emp-1',
      leaveAccruedThrough: new Date('2026-08-01T00:00:00Z'),
    });
    expect(creditCall[0].data.leaveAccruedThrough).toEqual(october);
    expect(creditCall[0].data.annualLeaveDays.increment.toString()).toBe('3.5'); // 2 months x 1.75
  });

  it('advances the marker of ended/inactive employees without crediting them', async () => {
    await service.accrueDueLeave(now);

    expect(prisma.employeeProfile.updateMany).toHaveBeenCalledWith({
      where: {
        status: { notIn: ['ACTIVE', 'PROBATION'] },
        OR: [{ leaveAccruedThrough: null }, { leaveAccruedThrough: { lt: october } }],
      },
      data: { leaveAccruedThrough: october },
    });
  });

  it('starts employees without a marker from the current month, with no back-credit', async () => {
    prisma.employeeProfile.findMany.mockResolvedValue([{ id: 'emp-2', leaveAccruedThrough: null }]);

    await expect(service.accrueDueLeave(now)).resolves.toBe(0);
    expect(prisma.employeeProfile.updateMany).toHaveBeenCalledWith({
      where: { id: 'emp-2', leaveAccruedThrough: null },
      data: { leaveAccruedThrough: october },
    });
  });

  it('does not credit when another instance already did (conditional update matched nothing)', async () => {
    prisma.employeeProfile.findMany.mockResolvedValue([
      { id: 'emp-1', leaveAccruedThrough: new Date('2026-09-01T00:00:00Z') },
    ]);
    prisma.employeeProfile.updateMany
      .mockResolvedValueOnce({ count: 0 }) // inactive sweep
      .mockResolvedValueOnce({ count: 0 }); // credit lost the race

    await expect(service.accrueDueLeave(now)).resolves.toBe(0);
  });
});
