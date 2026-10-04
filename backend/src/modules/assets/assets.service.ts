import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { QueryAssetsDto } from './dto/query-assets.dto';
import { AssignAssetDto } from './dto/assign-asset.dto';
import { ReturnAssetDto } from './dto/return-asset.dto';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { AssetStatus, Prisma } from '@prisma/client';

@Injectable()
export class AssetsService {
  constructor(private readonly prisma: PrismaService) {}

  private async getEmployeeProfile(userId: string) {
    return this.prisma.employeeProfile.findUnique({
      where: { userId },
    });
  }

  // ---------------------------------------------------------------------------
  // CREATE ASSET
  // ---------------------------------------------------------------------------

  async createAsset(dto: CreateAssetDto, user: AuthenticatedUser) {
    const existing = await this.prisma.asset.findUnique({
      where: { serialNumber: dto.serialNumber.trim() },
    });

    if (existing) {
      throw new ConflictException(
        `أصل بالرقم التسلسلي '${dto.serialNumber}' مسجل بالنظام مسبقاً.`,
      );
    }

    const actorEmployee = await this.getEmployeeProfile(user.id);

    // If assigned upon creation, verify employee
    if (dto.assigneeId) {
      const employee = await this.prisma.employeeProfile.findUnique({
        where: { id: dto.assigneeId },
      });
      if (!employee) {
        throw new NotFoundException('الموظف المحدد لإسناد العهدة غير موجود.');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const isAssigned = !!dto.assigneeId;

      const asset = await tx.asset.create({
        data: {
          name: dto.name.trim(),
          serialNumber: dto.serialNumber.trim(),
          type: dto.type,
          status: isAssigned ? AssetStatus.ASSIGNED : AssetStatus.AVAILABLE,
          model: dto.model?.trim() || null,
          manufacturer: dto.manufacturer?.trim() || null,
          purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : null,
          purchaseCost: dto.purchaseCost !== undefined ? dto.purchaseCost : null,
          warrantyExpiry: dto.warrantyExpiry ? new Date(dto.warrantyExpiry) : null,
          notes: dto.notes?.trim() || null,
          imageUrl: dto.imageUrl?.trim() || null,
          assigneeId: dto.assigneeId || null,
        },
        include: {
          assignee: {
            select: {
              id: true,
              fullName: true,
              employeeCode: true,
              avatarUrl: true,
              department: { select: { id: true, name: true, code: true } },
            },
          },
        },
      });

      // If assigned at creation, create initial assignment history log
      if (dto.assigneeId) {
        await tx.assetAssignmentHistory.create({
          data: {
            assetId: asset.id,
            employeeId: dto.assigneeId,
            assignedAt: new Date(),
            conditionNotes: dto.conditionNotes?.trim() || 'إسناد عند إضافة الأصل بالنظام',
            assignedById: actorEmployee?.id || null,
          },
        });
      }

      return asset;
    });
  }

  // ---------------------------------------------------------------------------
  // QUERY & FILTER ASSETS (WITH PAGINATION)
  // ---------------------------------------------------------------------------

  async getAssets(query: QueryAssetsDto) {
    const { search, type, status, assigneeId, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.AssetWhereInput = {};

    if (type) {
      where.type = type;
    }

    if (status) {
      where.status = status;
    }

    if (assigneeId) {
      where.assigneeId = assigneeId;
    }

    if (search && search.trim()) {
      const term = search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { serialNumber: { contains: term, mode: 'insensitive' } },
        { model: { contains: term, mode: 'insensitive' } },
        { manufacturer: { contains: term, mode: 'insensitive' } },
        { assignee: { fullName: { contains: term, mode: 'insensitive' } } },
        { assignee: { employeeCode: { contains: term, mode: 'insensitive' } } },
      ];
    }

    const [assets, total] = await Promise.all([
      this.prisma.asset.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          assignee: {
            select: {
              id: true,
              fullName: true,
              employeeCode: true,
              avatarUrl: true,
              department: { select: { id: true, name: true, code: true } },
            },
          },
          assignmentHistory: {
            orderBy: { assignedAt: 'desc' },
            include: {
              employee: {
                select: {
                  id: true,
                  fullName: true,
                  employeeCode: true,
                  avatarUrl: true,
                  department: { select: { id: true, name: true, code: true } },
                },
              },
              assignedBy: {
                select: {
                  id: true,
                  fullName: true,
                  employeeCode: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.asset.count({ where }),
    ]);

    return {
      data: assets,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // ASSET DASHBOARD SUMMARY STATISTICS
  // ---------------------------------------------------------------------------

  async getAssetStats() {
    const [
      totalAssets,
      availableCount,
      assignedCount,
      maintenanceCount,
      retiredCount,
      hardwareCount,
      softwareCount,
      furnitureCount,
      otherCount,
      costAggregate,
    ] = await Promise.all([
      this.prisma.asset.count(),
      this.prisma.asset.count({ where: { status: AssetStatus.AVAILABLE } }),
      this.prisma.asset.count({ where: { status: AssetStatus.ASSIGNED } }),
      this.prisma.asset.count({ where: { status: AssetStatus.IN_MAINTENANCE } }),
      this.prisma.asset.count({ where: { status: AssetStatus.RETIRED } }),
      this.prisma.asset.count({ where: { type: 'HARDWARE' } }),
      this.prisma.asset.count({ where: { type: 'SOFTWARE' } }),
      this.prisma.asset.count({ where: { type: 'FURNITURE' } }),
      this.prisma.asset.count({ where: { type: 'OTHER' } }),
      this.prisma.asset.aggregate({
        _sum: { purchaseCost: true },
      }),
    ]);

    return {
      totalAssets,
      availableCount,
      assignedCount,
      maintenanceCount,
      retiredCount,
      byType: {
        hardware: hardwareCount,
        software: softwareCount,
        furniture: furnitureCount,
        other: otherCount,
      },
      totalValuation: costAggregate._sum.purchaseCost || 0,
    };
  }

  // ---------------------------------------------------------------------------
  // GET SINGLE ASSET WITH FULL ASSIGNMENT HISTORY
  // ---------------------------------------------------------------------------

  async getAssetById(id: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { id },
      include: {
        assignee: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
            avatarUrl: true,
            department: { select: { id: true, name: true, code: true } },
            position: { select: { id: true, name: true } },
          },
        },
        assignmentHistory: {
          orderBy: { assignedAt: 'desc' },
          include: {
            employee: {
              select: {
                id: true,
                fullName: true,
                employeeCode: true,
                avatarUrl: true,
                department: { select: { id: true, name: true, code: true } },
              },
            },
            assignedBy: {
              select: {
                id: true,
                fullName: true,
                employeeCode: true,
              },
            },
          },
        },
      },
    });

    if (!asset) {
      throw new NotFoundException(`الأصل ذو المعرف '${id}' غير موجود.`);
    }

    return asset;
  }

  // ---------------------------------------------------------------------------
  // UPDATE ASSET
  // ---------------------------------------------------------------------------

  async updateAsset(id: string, dto: UpdateAssetDto) {
    const asset = await this.prisma.asset.findUnique({ where: { id } });
    if (!asset) {
      throw new NotFoundException(`الأصل ذو المعرف '${id}' غير موجود.`);
    }

    if (dto.serialNumber && dto.serialNumber.trim() !== asset.serialNumber) {
      const conflict = await this.prisma.asset.findUnique({
        where: { serialNumber: dto.serialNumber.trim() },
      });
      if (conflict) {
        throw new ConflictException(
          `أصل آخر بالرقم التسلسلي '${dto.serialNumber}' مسجل بالنظام مسبقاً.`,
        );
      }
    }

    return this.prisma.asset.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.serialNumber !== undefined && { serialNumber: dto.serialNumber.trim() }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.model !== undefined && { model: dto.model?.trim() || null }),
        ...(dto.manufacturer !== undefined && { manufacturer: dto.manufacturer?.trim() || null }),
        ...(dto.purchaseDate !== undefined && {
          purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : null,
        }),
        ...(dto.purchaseCost !== undefined && { purchaseCost: dto.purchaseCost }),
        ...(dto.warrantyExpiry !== undefined && {
          warrantyExpiry: dto.warrantyExpiry ? new Date(dto.warrantyExpiry) : null,
        }),
        ...(dto.notes !== undefined && { notes: dto.notes?.trim() || null }),
        ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl?.trim() || null }),
      },
      include: {
        assignee: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
            avatarUrl: true,
            department: { select: { id: true, name: true, code: true } },
          },
        },
      },
    });
  }

  // ---------------------------------------------------------------------------
  // DELETE ASSET
  // ---------------------------------------------------------------------------

  async deleteAsset(id: string) {
    const asset = await this.prisma.asset.findUnique({ where: { id } });
    if (!asset) {
      throw new NotFoundException(`الأصل ذو المعرف '${id}' غير موجود.`);
    }

    if (asset.status === AssetStatus.ASSIGNED || asset.assigneeId) {
      throw new BadRequestException(
        'لا يمكن حذف أصل مسلّم كعهدة لموظف حالياً. يرجى استرجاع العهدة أولاً.',
      );
    }

    await this.prisma.asset.delete({ where: { id } });
    return { success: true, message: 'تم حذف الأصل وسجلاته بنجاح.' };
  }

  // ---------------------------------------------------------------------------
  // ASSIGN ASSET TO EMPLOYEE (تسليم عهدة)
  // ---------------------------------------------------------------------------

  async assignAsset(id: string, dto: AssignAssetDto, user: AuthenticatedUser) {
    const asset = await this.prisma.asset.findUnique({ where: { id } });
    if (!asset) {
      throw new NotFoundException(`الأصل ذو المعرف '${id}' غير موجود.`);
    }

    if (asset.status === AssetStatus.RETIRED) {
      throw new BadRequestException('لا يمكن تسليم أصل خارج الخدمة أو تالف.');
    }

    const employee = await this.prisma.employeeProfile.findUnique({
      where: { id: dto.employeeId },
    });
    if (!employee) {
      throw new NotFoundException('الموظف المحدد غير موجود في سجلات الكوادر.');
    }

    const actorEmployee = await this.getEmployeeProfile(user.id);

    return this.prisma.$transaction(async (tx) => {
      // If previously assigned to another employee, close previous open record
      if (asset.assigneeId && asset.assigneeId !== dto.employeeId) {
        await tx.assetAssignmentHistory.updateMany({
          where: {
            assetId: id,
            returnedAt: null,
          },
          data: {
            returnedAt: new Date(),
            conditionNotes: 'تم نقل العهدة مباشرة لموظف آخر',
          },
        });
      }

      // Update Asset Status and Assignee
      const updatedAsset = await tx.asset.update({
        where: { id },
        data: {
          status: AssetStatus.ASSIGNED,
          assigneeId: dto.employeeId,
        },
        include: {
          assignee: {
            select: {
              id: true,
              fullName: true,
              employeeCode: true,
              avatarUrl: true,
              department: { select: { id: true, name: true, code: true } },
            },
          },
        },
      });

      // Create new Assignment History Log
      await tx.assetAssignmentHistory.create({
        data: {
          assetId: id,
          employeeId: dto.employeeId,
          assignedAt: new Date(),
          conditionNotes: dto.conditionNotes?.trim() || 'تسليم عهدة جديدة',
          assignedById: actorEmployee?.id || null,
        },
      });

      return updatedAsset;
    });
  }

  // ---------------------------------------------------------------------------
  // RETURN ASSET (استرجاع عهدة)
  // ---------------------------------------------------------------------------

  async returnAsset(id: string, dto: ReturnAssetDto) {
    const asset = await this.prisma.asset.findUnique({ where: { id } });
    if (!asset) {
      throw new NotFoundException(`الأصل ذو المعرف '${id}' غير موجود.`);
    }

    if (!asset.assigneeId && asset.status !== AssetStatus.ASSIGNED) {
      throw new BadRequestException('هذا الأصل غير مُسلّم لأي موظف حالياً.');
    }

    return this.prisma.$transaction(async (tx) => {
      // Close active assignment history record
      await tx.assetAssignmentHistory.updateMany({
        where: {
          assetId: id,
          returnedAt: null,
        },
        data: {
          returnedAt: new Date(),
          conditionNotes: dto.conditionNotes?.trim()
            ? `ملاحظات الاسترجاع: ${dto.conditionNotes.trim()}`
            : 'تم استرجاع العهدة وتفريغ الأصل',
        },
      });

      // Free the asset
      const updatedAsset = await tx.asset.update({
        where: { id },
        data: {
          status: dto.status || AssetStatus.AVAILABLE,
          assigneeId: null,
        },
        include: {
          assignee: true,
        },
      });

      return updatedAsset;
    });
  }

  // ---------------------------------------------------------------------------
  // GET EMPLOYEE ASSIGNED ASSETS (عهدة موظف)
  // ---------------------------------------------------------------------------

  async getEmployeeAssets(employeeId: string) {
    const employee = await this.prisma.employeeProfile.findUnique({
      where: { id: employeeId },
    });
    if (!employee) {
      throw new NotFoundException('الموظف غير موجود.');
    }

    const [activeAssets, history] = await Promise.all([
      this.prisma.asset.findMany({
        where: { assigneeId: employeeId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.assetAssignmentHistory.findMany({
        where: { employeeId },
        orderBy: { assignedAt: 'desc' },
        include: {
          asset: {
            select: {
              id: true,
              name: true,
              serialNumber: true,
              type: true,
              model: true,
              manufacturer: true,
            },
          },
          assignedBy: {
            select: {
              id: true,
              fullName: true,
              employeeCode: true,
            },
          },
        },
      }),
    ]);

    return {
      activeAssets,
      history,
    };
  }
}
