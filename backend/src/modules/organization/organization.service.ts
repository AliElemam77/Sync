import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { CreatePositionDto } from './dto/create-position.dto';
import { UpdatePositionDto } from './dto/update-position.dto';
import { CreateLevelDto } from './dto/create-level.dto';
import { UpdateLevelDto } from './dto/update-level.dto';

@Injectable()
export class OrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // FULL ORGANIZATION HIERARCHY TREE
  // ---------------------------------------------------------------------------

  async getOrganizationTree() {
    return this.prisma.department.findMany({
      orderBy: { name: 'asc' },
      include: {
        positions: {
          orderBy: { name: 'asc' },
          include: {
            levels: {
              orderBy: { rank: 'asc' },
            },
          },
        },
      },
    });
  }

  // ---------------------------------------------------------------------------
  // DEPARTMENT CRUD
  // ---------------------------------------------------------------------------

  async getDepartments() {
    return this.prisma.department.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { positions: true },
        },
      },
    });
  }

  async getDepartmentById(id: string) {
    const department = await this.prisma.department.findUnique({
      where: { id },
      include: {
        positions: {
          include: {
            levels: { orderBy: { rank: 'asc' } },
          },
        },
      },
    });

    if (!department) {
      throw new NotFoundException(`Department with ID '${id}' not found`);
    }

    return department;
  }

  async createDepartment(dto: CreateDepartmentDto) {
    const existingCode = await this.prisma.department.findUnique({
      where: { code: dto.code.toUpperCase().trim() },
    });

    if (existingCode) {
      throw new ConflictException(
        `Department with code '${dto.code}' already exists`,
      );
    }

    return this.prisma.department.create({
      data: {
        name: dto.name.trim(),
        code: dto.code.toUpperCase().trim(),
        description: dto.description?.trim() || null,
      },
    });
  }

  async updateDepartment(id: string, dto: UpdateDepartmentDto) {
    await this.getDepartmentById(id);

    return this.prisma.department.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name.trim() }),
        ...(dto.description !== undefined && { description: dto.description?.trim() || null }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async deleteDepartment(id: string) {
    const department = await this.prisma.department.findUnique({
      where: { id },
      include: {
        _count: { select: { positions: true } },
      },
    });

    if (!department) {
      throw new NotFoundException(`Department with ID '${id}' not found`);
    }

    if (department._count.positions > 0) {
      throw new BadRequestException(
        `Cannot delete department '${department.name}' because it contains ${department._count.positions} linked positions. Remove or reassign them first.`,
      );
    }

    return this.prisma.department.delete({
      where: { id },
    });
  }

  // ---------------------------------------------------------------------------
  // POSITION CRUD
  // ---------------------------------------------------------------------------

  async getPositions(departmentId?: string) {
    return this.prisma.position.findMany({
      where: departmentId ? { departmentId } : undefined,
      orderBy: { name: 'asc' },
      include: {
        department: { select: { id: true, name: true, code: true } },
        levels: { orderBy: { rank: 'asc' } },
      },
    });
  }

  async getPositionById(id: string) {
    const position = await this.prisma.position.findUnique({
      where: { id },
      include: {
        department: true,
        levels: { orderBy: { rank: 'asc' } },
      },
    });

    if (!position) {
      throw new NotFoundException(`Position with ID '${id}' not found`);
    }

    return position;
  }

  async createPosition(dto: CreatePositionDto) {
    // Validate department exists
    const department = await this.prisma.department.findUnique({
      where: { id: dto.departmentId },
    });

    if (!department) {
      throw new NotFoundException(
        `Department with ID '${dto.departmentId}' not found`,
      );
    }

    // Check unique composite name within department
    const existing = await this.prisma.position.findUnique({
      where: {
        departmentId_name: {
          departmentId: dto.departmentId,
          name: dto.name.trim(),
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `Position '${dto.name}' already exists in department '${department.name}'`,
      );
    }

    return this.prisma.position.create({
      data: {
        name: dto.name.trim(),
        departmentId: dto.departmentId,
        description: dto.description?.trim() || null,
      },
      include: {
        department: true,
        levels: true,
      },
    });
  }

  async updatePosition(id: string, dto: UpdatePositionDto) {
    await this.getPositionById(id);

    return this.prisma.position.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name.trim() }),
        ...(dto.description !== undefined && { description: dto.description?.trim() || null }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: {
        department: true,
        levels: true,
      },
    });
  }

  async deletePosition(id: string) {
    const position = await this.prisma.position.findUnique({
      where: { id },
      include: {
        _count: { select: { levels: true } },
      },
    });

    if (!position) {
      throw new NotFoundException(`Position with ID '${id}' not found`);
    }

    if (position._count.levels > 0) {
      throw new BadRequestException(
        `Cannot delete position '${position.name}' because it contains ${position._count.levels} linked levels. Remove levels first.`,
      );
    }

    return this.prisma.position.delete({
      where: { id },
    });
  }

  // ---------------------------------------------------------------------------
  // LEVEL CRUD
  // ---------------------------------------------------------------------------

  async getLevels(positionId?: string) {
    return this.prisma.level.findMany({
      where: positionId ? { positionId } : undefined,
      orderBy: { rank: 'asc' },
      include: {
        position: {
          select: {
            id: true,
            name: true,
            department: { select: { id: true, name: true } },
          },
        },
      },
    });
  }

  async createLevel(dto: CreateLevelDto) {
    const position = await this.prisma.position.findUnique({
      where: { id: dto.positionId },
    });

    if (!position) {
      throw new NotFoundException(
        `Position with ID '${dto.positionId}' not found`,
      );
    }

    const existing = await this.prisma.level.findUnique({
      where: {
        positionId_name: {
          positionId: dto.positionId,
          name: dto.name.trim(),
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `Level '${dto.name}' already exists in position '${position.name}'`,
      );
    }

    return this.prisma.level.create({
      data: {
        name: dto.name.trim(),
        positionId: dto.positionId,
        rank: dto.rank ?? 1,
        description: dto.description?.trim() || null,
      },
    });
  }

  async updateLevel(id: string, dto: UpdateLevelDto) {
    const level = await this.prisma.level.findUnique({ where: { id } });
    if (!level) {
      throw new NotFoundException(`Level with ID '${id}' not found`);
    }

    return this.prisma.level.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name.trim() }),
        ...(dto.rank !== undefined && { rank: dto.rank }),
        ...(dto.description !== undefined && { description: dto.description?.trim() || null }),
      },
    });
  }

  async deleteLevel(id: string) {
    const level = await this.prisma.level.findUnique({ where: { id } });
    if (!level) {
      throw new NotFoundException(`Level with ID '${id}' not found`);
    }

    return this.prisma.level.delete({
      where: { id },
    });
  }
}
