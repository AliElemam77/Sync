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
import { Prisma, ShiftType } from '@prisma/client';

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

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
        },
      });

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

    // Calculate hierarchical scoping for the requesting user
    let scopedDepartmentIds: string[] | null = null; // null = full company access

    if (currentUser) {
      const roleName = currentUser.role?.toUpperCase() || '';
      const isSuperAdminOrAdmin = [
        'SUPER_ADMIN',
        'ADMIN',
        'HR_MANAGER',
        'GENERAL_MANAGER',
        'EXECUTIVE_MANAGER',
        'DIRECTOR',
      ].includes(roleName);

      if (!isSuperAdminOrAdmin) {
        const actorEmployee = await this.prisma.employeeProfile.findUnique({
          where: { userId: currentUser.id },
          include: { department: true, position: true },
        });

        const deptCode = actorEmployee?.department?.code?.toUpperCase() || '';
        const deptName = actorEmployee?.department?.name?.toLowerCase() || '';

        const isHR =
          ['HR', 'HRD', 'HUMAN_RESOURCES'].includes(deptCode) ||
          deptName.includes('موارد بشرية') ||
          deptName.includes('hr');

        const isMgmt =
          ['MGMT', 'MGT', 'CORP', 'ADMIN', 'EXEC', 'HQ', 'BOARD'].includes(deptCode) ||
          deptName.includes('إدارة عامة') ||
          deptName.includes('management') ||
          deptName.includes('executive');

        if (!isHR && !isMgmt) {
          const posName = actorEmployee?.position?.name?.toLowerCase() || '';
          const isHead =
            roleName.includes('HEAD') ||
            posName.includes('head') ||
            posName.includes('رئيس') ||
            posName.includes('مدير إدارة');

          if (actorEmployee?.departmentId) {
            if (isHead) {
              // A Head oversees their department and related department hierarchy
              const prefix = deptCode.split('_')[0];
              const relatedDepts = await this.prisma.department.findMany({
                where: {
                  OR: [
                    { id: actorEmployee.departmentId },
                    ...(prefix ? [{ code: { startsWith: prefix } }] : []),
                  ],
                },
                select: { id: true },
              });
              scopedDepartmentIds = relatedDepts.map((d) => d.id);
            } else {
              // Team Leaders and Agents see their own department (team members / colleagues)
              scopedDepartmentIds = [actorEmployee.departmentId];
            }
          } else {
            scopedDepartmentIds = [];
          }
        }
      }
    }

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
        include: {
          user: { select: { id: true, email: true, isActive: true } },
          department: { select: { id: true, name: true, code: true } },
          position: { select: { id: true, name: true } },
          level: { select: { id: true, name: true, rank: true } },
          emergencyContact: true,
          bankInfo: true,
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
      },
    });

    if (!employee) {
      throw new NotFoundException(`Employee with ID '${id}' not found`);
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
      include: { user: true, bankInfo: true, emergencyContact: true },
    });

    if (!existing) {
      throw new NotFoundException(`Employee with ID '${id}' not found`);
    }

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
      },
    });

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
  // DATA MASKING UTILITY (RBAC Field-Level Privacy)
  // ---------------------------------------------------------------------------

  private maskSensitiveData(employee: any, currentUser?: AuthenticatedUser) {
    if (!employee) return null;

    const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';
    const canManageSalary =
      currentUser?.permissions?.includes('employees.manage_salary') || isSuperAdmin;

    if (!canManageSalary && employee.bankInfo) {
      employee.bankInfo = {
        isMasked: true,
        message: 'Access restricted: Missing employees.manage_salary permission',
      };
    }

    return employee;
  }
}
