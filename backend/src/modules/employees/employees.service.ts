import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { QueryEmployeesDto } from './dto/query-employees.dto';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { AccessScopeService } from '../../common/access/access-scope.service';
import { Prisma, ShiftType } from '@prisma/client';

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessScopeService,
  ) {}

  // ---------------------------------------------------------------------------
  // AUTO-SEQUENTIAL CODE GENERATION (TAR0001, TAR0002, ...)
  // ---------------------------------------------------------------------------

  async getNextEmployeeCode(): Promise<string> {
    return this.generateNextCode(this.prisma);
  }

  private async generateNextCode(
    tx: Prisma.TransactionClient | PrismaService,
  ): Promise<string> {
    const lastEmployee = await tx.employeeProfile.findFirst({
      where: { employeeCode: { startsWith: 'TAR' } },
      orderBy: { employeeCode: 'desc' },
      select: { employeeCode: true },
    });

    if (!lastEmployee || !lastEmployee.employeeCode) {
      return 'TAR0001';
    }

    const numericPart = lastEmployee.employeeCode.replace('TAR', '');
    const nextNumber = parseInt(numericPart, 10) + 1;
    return `TAR${String(nextNumber).padStart(4, '0')}`;
  }

  // ---------------------------------------------------------------------------
  // ATOMIC EMPLOYEE CREATION (User + Profile + Entitlements + Sub-aggregates)
  // ---------------------------------------------------------------------------

  async createEmployee(
    dto: CreateEmployeeDto,
    currentUser?: AuthenticatedUser,
  ) {
    this.assertCanWriteSalary(dto.bankInfo, currentUser);

    const email = dto.email.toLowerCase().trim();

    // Verify email uniqueness before transaction
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException(`User with email '${dto.email}' already exists`);
    }

    // Verify Department and Position exist
    const department = await this.prisma.department.findUnique({
      where: { id: dto.departmentId },
    });
    if (!department) {
      throw new NotFoundException(`Department with ID '${dto.departmentId}' not found`);
    }

    const position = await this.prisma.position.findUnique({
      where: { id: dto.positionId },
    });
    if (!position) {
      throw new NotFoundException(`Position with ID '${dto.positionId}' not found`);
    }

    // Hash password with bcrypt (12 rounds)
    const passwordHash = await bcrypt.hash(dto.password, 12);

    // Fetch default Employee role
    const employeeRole = await this.prisma.role.findFirst({
      where: { name: 'EMPLOYEE' },
    });

    if (!employeeRole) {
      throw new BadRequestException(
        'System role EMPLOYEE not found. Run database seeding first.',
      );
    }

    // Execute atomic transaction
    return this.prisma.$transaction(async (tx) => {
      const employeeCode = await this.generateNextCode(tx);

      // 1. Create Auth User
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          roleId: employeeRole.id,
          isActive: dto.status !== 'INACTIVE' && dto.status !== 'ENDED',
        },
      });

      // 2. Create Employee Profile with wireframe defaults
      const employeeProfile = await tx.employeeProfile.create({
        data: {
          userId: user.id,
          employeeCode,
          fullName: dto.fullName.trim(),
          phone: dto.phone.trim(),
          dob: dto.dob ? new Date(dto.dob) : null,
          gender: dto.gender ?? 'MALE',
          avatarUrl: dto.avatarUrl || null,
          shiftType: dto.shiftType ?? ShiftType.RS,
          monthlyPermissionHours: 4, // Default business requirement
          annualLeaveDays: 21,        // Default business requirement
          company: dto.company?.trim() || 'Tawfeer',
          branch: dto.branch?.trim() || 'Headquarters',
          departmentId: dto.departmentId,
          positionId: dto.positionId,
          levelId: dto.levelId || null,
          joiningDate: dto.joiningDate ? new Date(dto.joiningDate) : new Date(),
          employmentType: dto.employmentType ?? 'FULL_TIME',
          status: dto.status ?? 'ACTIVE',
          address: dto.address?.trim() || null,
          altPhone: dto.altPhone?.trim() || null,
          ...(dto.emergencyContact && {
            emergencyContact: {
              create: {
                name: dto.emergencyContact.name.trim(),
                relationship: dto.emergencyContact.relationship ?? 'OTHER',
                phone: dto.emergencyContact.phone.trim(),
              },
            },
          }),
          ...(dto.bankInfo && {
            bankInfo: {
              create: {
                bankName: dto.bankInfo.bankName?.trim() || null,
                accountHolder: dto.bankInfo.accountHolder?.trim() || null,
                accountNumber: dto.bankInfo.accountNumber?.trim() || null,
                iban: dto.bankInfo.iban?.trim() || null,
                swift: dto.bankInfo.swift?.trim() || null,
                branch: dto.bankInfo.branch?.trim() || null,
                basicSalary: dto.bankInfo.basicSalary ?? 0.0,
              },
            },
          }),
        },
        include: {
          user: { select: { id: true, email: true, isActive: true } },
          department: { select: { id: true, name: true, code: true } },
          position: { select: { id: true, name: true } },
          level: { select: { id: true, name: true, rank: true } },
          emergencyContact: true,
          bankInfo: true,
          managedDepartments: { select: { id: true, name: true, code: true } },
        },
      });

      // Link managed departments if this employee is assigned as Head of multiple departments
      if (dto.managedDepartmentIds && dto.managedDepartmentIds.length > 0) {
        await tx.department.updateMany({
          where: { id: { in: dto.managedDepartmentIds } },
          data: { headId: employeeProfile.id },
        });
      }

      return this.maskSensitiveData(employeeProfile, currentUser);
    });
  }

  // ---------------------------------------------------------------------------
  // QUERY DIRECTORY & SERVER-SIDE PAGINATION
  // ---------------------------------------------------------------------------

  async getEmployees(query: QueryEmployeesDto, currentUser?: AuthenticatedUser) {
    const {
      search,
      departmentId,
      positionId,
      status,
      shiftType,
      page = 1,
      limit = 10,
    } = query;

    const skip = (page - 1) * limit;

    const scopedDepartmentIds = currentUser
      ? await this.access.resolveDirectoryScope(currentUser)
      : null;

    const where: Prisma.EmployeeProfileWhereInput = {
      ...(scopedDepartmentIds !== null
        ? {
            departmentId: {
              in:
                departmentId && scopedDepartmentIds.includes(departmentId)
                  ? [departmentId]
                  : scopedDepartmentIds,
            },
          }
        : departmentId
        ? { departmentId }
        : {}),
      ...(positionId && { positionId }),
      ...(status && { status }),
      ...(shiftType && { shiftType }),
      ...(search && {
        OR: [
          { fullName: { contains: search, mode: 'insensitive' } },
          { employeeCode: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
          { user: { email: { contains: search, mode: 'insensitive' } } },
        ],
      }),
    };

    const [total, records] = await Promise.all([
      this.prisma.employeeProfile.count({ where }),
      this.prisma.employeeProfile.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        // Directory rows only; emergency contact and bank details come from GET /employees/:id
        include: {
          user: { select: { id: true, email: true, isActive: true } },
          department: { select: { id: true, name: true, code: true } },
          position: { select: { id: true, name: true } },
          level: { select: { id: true, name: true, rank: true } },
          managedDepartments: { select: { id: true, name: true, code: true } },
        },
      }),
    ]);

    const sanitizedRecords = records.map((emp) =>
      this.maskSensitiveData(emp, currentUser),
    );

    return {
      data: sanitizedRecords,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getEmployeeById(id: string, currentUser?: AuthenticatedUser) {
    const employee = await this.prisma.employeeProfile.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, isActive: true } },
        department: { select: { id: true, name: true, code: true } },
        position: { select: { id: true, name: true } },
        level: { select: { id: true, name: true, rank: true } },
        emergencyContact: true,
        bankInfo: true,
        documents: true,
        managedDepartments: { select: { id: true, name: true, code: true } },
      },
    });

    if (!employee) {
      throw new NotFoundException(`Employee with ID '${id}' not found`);
    }

    // Same visibility as the directory list: users may open profiles they can see there, plus their own
    if (currentUser && employee.userId !== currentUser.id) {
      const scopedDepartmentIds = await this.access.resolveDirectoryScope(currentUser);
      if (scopedDepartmentIds !== null && !scopedDepartmentIds.includes(employee.departmentId)) {
        throw new NotFoundException(`Employee with ID '${id}' not found`);
      }
    }

    return this.maskSensitiveData(employee, currentUser);
  }

  // ---------------------------------------------------------------------------
  // UPDATE EMPLOYEE PROFILE
  // ---------------------------------------------------------------------------

  async updateEmployee(
    id: string,
    dto: UpdateEmployeeDto,
    currentUser?: AuthenticatedUser,
  ) {
    const existing = await this.prisma.employeeProfile.findUnique({
      where: { id },
      include: {
        user: { include: { role: { select: { name: true } } } },
        bankInfo: true,
        emergencyContact: true,
      },
    });

    if (!existing) {
      throw new NotFoundException(`Employee with ID '${id}' not found`);
    }

    await this.assertCanChangeAccount(existing.userId, existing.user.role.name, dto, currentUser);
    this.assertCanWriteSalary(dto.bankInfo, currentUser);

    // Handle user account updates (email, password, status, role)
    if (dto.email && dto.email.toLowerCase().trim() !== existing.user.email.toLowerCase()) {
      const emailTaken = await this.prisma.user.findUnique({
        where: { email: dto.email.toLowerCase().trim() },
      });
      if (emailTaken && emailTaken.id !== existing.userId) {
        throw new ConflictException(`Email '${dto.email}' is already registered.`);
      }
    }

    const userDataToUpdate: Prisma.UserUpdateInput = {
      ...(dto.email && { email: dto.email.toLowerCase().trim() }),
      ...(dto.password && { passwordHash: await bcrypt.hash(dto.password, 12) }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      ...(dto.roleId && { role: { connect: { id: dto.roleId } } }),
    };

    if (Object.keys(userDataToUpdate).length > 0) {
      await this.prisma.user.update({
        where: { id: existing.userId },
        data: userDataToUpdate,
      });
    }

    const updated = await this.prisma.employeeProfile.update({
      where: { id },
      data: {
        ...(dto.fullName && { fullName: dto.fullName.trim() }),
        ...(dto.phone && { phone: dto.phone.trim() }),
        ...(dto.dob !== undefined && { dob: dto.dob ? new Date(dto.dob) : null }),
        ...(dto.gender && { gender: dto.gender }),
        ...(dto.shiftType && { shiftType: dto.shiftType }),
        ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl }),
        ...(dto.company && { company: dto.company.trim() }),
        ...(dto.branch && { branch: dto.branch.trim() }),
        ...(dto.departmentId && { departmentId: dto.departmentId }),
        ...(dto.positionId && { positionId: dto.positionId }),
        ...(dto.levelId !== undefined && { levelId: dto.levelId || null }),
        ...(dto.joiningDate && { joiningDate: new Date(dto.joiningDate) }),
        ...(dto.employmentType && { employmentType: dto.employmentType }),
        ...(dto.status && { status: dto.status }),
        ...(dto.annualLeaveDays !== undefined && { annualLeaveDays: dto.annualLeaveDays }),
        ...(dto.monthlyPermissionHours !== undefined && { monthlyPermissionHours: dto.monthlyPermissionHours }),
        ...(dto.address !== undefined && { address: dto.address?.trim() || null }),
        ...(dto.altPhone !== undefined && { altPhone: dto.altPhone?.trim() || null }),
        ...(dto.emergencyContact && {
          emergencyContact: {
            upsert: {
              create: {
                name: dto.emergencyContact.name.trim(),
                relationship: dto.emergencyContact.relationship ?? 'OTHER',
                phone: dto.emergencyContact.phone.trim(),
              },
              update: {
                name: dto.emergencyContact.name.trim(),
                relationship: dto.emergencyContact.relationship ?? 'OTHER',
                phone: dto.emergencyContact.phone.trim(),
              },
            },
          },
        }),
        ...(dto.bankInfo && {
          bankInfo: {
            upsert: {
              create: {
                bankName: dto.bankInfo.bankName?.trim() || null,
                accountHolder: dto.bankInfo.accountHolder?.trim() || null,
                accountNumber: dto.bankInfo.accountNumber?.trim() || null,
                iban: dto.bankInfo.iban?.trim() || null,
                swift: dto.bankInfo.swift?.trim() || null,
                branch: dto.bankInfo.branch?.trim() || null,
                basicSalary: dto.bankInfo.basicSalary ?? 0.0,
              },
              update: {
                ...(dto.bankInfo.bankName !== undefined && { bankName: dto.bankInfo.bankName?.trim() || null }),
                ...(dto.bankInfo.accountHolder !== undefined && { accountHolder: dto.bankInfo.accountHolder?.trim() || null }),
                ...(dto.bankInfo.accountNumber !== undefined && { accountNumber: dto.bankInfo.accountNumber?.trim() || null }),
                ...(dto.bankInfo.iban !== undefined && { iban: dto.bankInfo.iban?.trim() || null }),
                ...(dto.bankInfo.swift !== undefined && { swift: dto.bankInfo.swift?.trim() || null }),
                ...(dto.bankInfo.branch !== undefined && { branch: dto.bankInfo.branch?.trim() || null }),
                ...(dto.bankInfo.basicSalary !== undefined && { basicSalary: dto.bankInfo.basicSalary }),
              },
            },
          },
        }),
      },
      include: {
        user: { select: { id: true, email: true, isActive: true } },
        department: { select: { id: true, name: true, code: true } },
        position: { select: { id: true, name: true } },
        level: { select: { id: true, name: true, rank: true } },
        emergencyContact: true,
        bankInfo: true,
        managedDepartments: { select: { id: true, name: true, code: true } },
      },
    });

    // Handle Multi-Department Management assignment updates
    if (dto.managedDepartmentIds !== undefined) {
      // 1. Clear any departments previously managed by this employee that are not in the new list
      await this.prisma.department.updateMany({
        where: {
          headId: id,
          id: { notIn: dto.managedDepartmentIds },
        },
        data: { headId: null },
      });

      // 2. Set headId for newly selected departments
      if (dto.managedDepartmentIds.length > 0) {
        await this.prisma.department.updateMany({
          where: { id: { in: dto.managedDepartmentIds } },
          data: { headId: id },
        });
      }

      // Re-fetch to return accurate managedDepartments
      const refreshed = await this.prisma.employeeProfile.findUnique({
        where: { id },
        include: {
          user: { select: { id: true, email: true, isActive: true } },
          department: { select: { id: true, name: true, code: true } },
          position: { select: { id: true, name: true } },
          level: { select: { id: true, name: true, rank: true } },
          emergencyContact: true,
          bankInfo: true,
          managedDepartments: { select: { id: true, name: true, code: true } },
        },
      });

      return this.maskSensitiveData(refreshed!, currentUser);
    }

    return this.maskSensitiveData(updated, currentUser);
  }

  // ---------------------------------------------------------------------------
  // DELETE EMPLOYEE
  // ---------------------------------------------------------------------------

  async deleteEmployee(id: string) {
    const employee = await this.prisma.employeeProfile.findUnique({
      where: { id },
    });

    if (!employee) {
      throw new NotFoundException(`Employee with ID '${id}' not found`);
    }

    // Cascade deletes employee profile and user account
    return this.prisma.user.delete({
      where: { id: employee.userId },
    });
  }

  // ---------------------------------------------------------------------------
  // ACCOUNT-LEVEL CHANGE GUARD (role, credentials, activation)
  // ---------------------------------------------------------------------------

  private async assertCanChangeAccount(
    targetUserId: string,
    targetRoleName: string,
    dto: UpdateEmployeeDto,
    currentUser?: AuthenticatedUser,
  ) {
    const changesAccount =
      dto.roleId !== undefined ||
      dto.email !== undefined ||
      dto.password !== undefined ||
      dto.isActive !== undefined;

    if (!changesAccount) return;

    const actorIsSuperAdmin = !!currentUser && this.access.isSuperAdmin(currentUser);

    // Only a Super Admin may change a Super Admin's login, password, activation or role
    if (targetRoleName === 'SUPER_ADMIN' && !actorIsSuperAdmin) {
      throw new ForbiddenException('Only a Super Admin can modify a Super Admin account.');
    }

    if (dto.roleId === undefined) return;

    const canManageRoles = !!currentUser && this.access.hasPermission(currentUser, 'roles.manage');
    if (!canManageRoles) {
      throw new ForbiddenException('Changing user roles requires the roles.manage permission.');
    }

    if (currentUser?.id === targetUserId) {
      throw new ForbiddenException('You cannot change your own role.');
    }

    const newRole = await this.prisma.role.findUnique({
      where: { id: dto.roleId },
      select: { name: true },
    });
    if (!newRole) {
      throw new BadRequestException(`Role with ID '${dto.roleId}' not found`);
    }
    if (newRole.name === 'SUPER_ADMIN' && !actorIsSuperAdmin) {
      throw new ForbiddenException('Only a Super Admin can grant the Super Admin role.');
    }
  }

  // Bank and salary details are hidden from users without employees.manage_salary; they may not write them either
  private assertCanWriteSalary(bankInfo: unknown, currentUser?: AuthenticatedUser) {
    if (bankInfo === undefined) return;
    if (!currentUser || !this.access.hasPermission(currentUser, 'employees.manage_salary')) {
      throw new ForbiddenException(
        'Bank and salary details require the employees.manage_salary permission.',
      );
    }
  }

  // ---------------------------------------------------------------------------
  // DATA MASKING UTILITY (RBAC Field-Level Privacy)
  // ---------------------------------------------------------------------------

  private maskSensitiveData(employee: any, currentUser?: AuthenticatedUser) {
    if (!employee) return null;

    const canManageSalary =
      !!currentUser && this.access.hasPermission(currentUser, 'employees.manage_salary');

    if (!canManageSalary && employee.bankInfo) {
      employee.bankInfo = {
        isMasked: true,
        message: 'Access restricted: Missing employees.manage_salary permission',
      };
    }

    return employee;
  }
}
