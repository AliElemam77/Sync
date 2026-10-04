import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto, UserProfileDto } from './dto/auth-response.dto';
import { JwtPayload } from './strategies/jwt.strategy';
import { AuditAction, Prisma } from '@prisma/client';
import {
  AccessScopeService,
  MANAGEMENT_DEPARTMENT_CODE,
} from '../../common/access/access-scope.service';

const USER_PROFILE_INCLUDE = {
  role: {
    include: {
      rolePermissions: {
        include: { permission: true },
      },
    },
  },
  employeeProfile: {
    include: {
      department: { select: { id: true, name: true, code: true } },
      position: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.UserInclude;

type UserWithProfile = Prisma.UserGetPayload<{ include: typeof USER_PROFILE_INCLUDE }>;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly auditService: AuditService,
    private readonly access: AccessScopeService,
  ) {}

  async login(
    dto: LoginDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<LoginResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
      include: USER_PROFILE_INCLUDE,
    });

    if (!user) {
      await this.auditService.log({
        action: AuditAction.LOGIN_FAILED,
        entity: 'User',
        metadata: { email: dto.email, reason: 'USER_NOT_FOUND' },
        ipAddress,
        userAgent,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      await this.auditService.log({
        userId: user.id,
        action: AuditAction.LOGIN_FAILED,
        entity: 'User',
        entityId: user.id,
        metadata: { reason: 'ACCOUNT_DEACTIVATED' },
        ipAddress,
        userAgent,
      });
      throw new ForbiddenException('Account has been deactivated');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      await this.auditService.log({
        userId: user.id,
        action: AuditAction.LOGIN_FAILED,
        entity: 'User',
        entityId: user.id,
        metadata: { reason: 'INVALID_PASSWORD' },
        ipAddress,
        userAgent,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role.name,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    await this.auditService.log({
      userId: user.id,
      action: AuditAction.LOGIN,
      entity: 'User',
      entityId: user.id,
      metadata: { loginMethod: 'PASSWORD' },
      ipAddress,
      userAgent,
    });

    return {
      accessToken,
      user: await this.toUserProfile(user),
    };
  }

  async getMe(userId: string): Promise<UserProfileDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: USER_PROFILE_INCLUDE,
    });

    if (!user) {
      throw new UnauthorizedException('User context invalid');
    }

    return this.toUserProfile(user);
  }

  private async toUserProfile(user: UserWithProfile): Promise<UserProfileDto> {
    const permissions = user.role.rolePermissions.map((rp) => rp.permission.name);
    const profile = user.employeeProfile;
    const isManagement = profile?.department?.code === MANAGEMENT_DEPARTMENT_CODE;

    const approvalDepartments = await this.access.getApprovalDepartmentIds({
      id: user.id,
      email: user.email,
      roleId: user.roleId,
      role: user.role.name,
      permissions,
      employeeId: profile?.id ?? null,
      departmentId: profile?.departmentId ?? null,
      isManagement,
    });

    return {
      id: user.id,
      email: user.email,
      isActive: user.isActive,
      role: {
        id: user.role.id,
        name: user.role.name,
      },
      permissions,
      isManagement,
      canApproveRequests: approvalDepartments === null || approvalDepartments.length > 0,
      createdAt: user.createdAt,
      employee: profile
        ? {
            id: profile.id,
            employeeCode: profile.employeeCode,
            fullName: profile.fullName,
            avatarUrl: profile.avatarUrl,
            department: profile.department
              ? {
                  id: profile.department.id,
                  name: profile.department.name,
                  code: profile.department.code,
                }
              : null,
            position: profile.position
              ? {
                  id: profile.position.id,
                  name: profile.position.name,
                }
              : null,
          }
        : null,
    };
  }
}
