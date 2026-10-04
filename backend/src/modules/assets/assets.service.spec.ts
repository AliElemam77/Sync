import { AssetStatus, AssetType, Prisma } from '@prisma/client';
import { AssetsService } from './assets.service';

describe('AssetsService.getAssetStats', () => {
  it('builds the dashboard counts from two grouped queries and one aggregate', async () => {
    const prisma = {
      asset: {
        groupBy: jest.fn(({ by }: { by: string[] }) =>
          by[0] === 'status'
            ? [
                { status: AssetStatus.AVAILABLE, _count: { _all: 4 } },
                { status: AssetStatus.ASSIGNED, _count: { _all: 6 } },
              ]
            : [
                { type: AssetType.HARDWARE, _count: { _all: 8 } },
                { type: AssetType.SOFTWARE, _count: { _all: 2 } },
              ],
        ),
        aggregate: jest.fn().mockResolvedValue({
          _count: { _all: 10 },
          _sum: { purchaseCost: new Prisma.Decimal('15250.50') },
        }),
      },
    };

    const stats = await new AssetsService(prisma as any).getAssetStats();

    expect(prisma.asset.groupBy).toHaveBeenCalledTimes(2);
    expect(stats).toEqual({
      totalAssets: 10,
      availableCount: 4,
      assignedCount: 6,
      maintenanceCount: 0,
      retiredCount: 0,
      byType: { hardware: 8, software: 2, furniture: 0, other: 0 },
      totalValuation: new Prisma.Decimal('15250.50'),
    });
  });
});
