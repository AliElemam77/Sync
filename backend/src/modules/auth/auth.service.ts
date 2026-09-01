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
import { AuditAction } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly auditService: AuditService,
  ) {}

  async login(
    dto: LoginDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<LoginResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
      include: {
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
      },
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

    const permissions = user.role.rolePermissions.map(
      (rp) => rp.permission.name,
    );

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
      user: {
        id: user.id,
        email: user.email,
        isActive: user.isActive,
        role: {
          id: user.role.id,
          name: user.role.name,
        },
        permissions,
        createdAt: user.createdAt,
        employee: user.employeeProfile
          ? {
              id: user.employeeProfile.id,
              employeeCode: user.employeeProfile.employeeCode,
              fullName: user.employeeProfile.fullName,
              avatarUrl: user.employeeProfile.avatarUrl,
              department: user.employeeProfile.department
                ? {
                    id: user.employeeProfile.department.id,
                    name: user.employeeProfile.department.name,
                    code: user.employeeProfile.department.code,
                  }
                : null,
              position: user.employeeProfile.position
                ? {
                    id: user.employeeProfile.position.id,
                    name: user.employeeProfile.position.name,
                  }
                : null,
            }
          : null,
      },
    };
  }

  async getMe(userId: string): Promise<UserProfileDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
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
      },
    });

    if (!user) {
      throw new UnauthorizedException('User context invalid');
    }

    return {
      id: user.id,
      email: user.email,
      isActive: user.isActive,
      role: {
        id: user.role.id,
        name: user.role.name,
      },
      permissions: user.role.rolePermissions.map((rp) => rp.permission.name),
      createdAt: user.createdAt,
      employee: user.employeeProfile
        ? {
            id: user.employeeProfile.id,
            employeeCode: user.employeeProfile.employeeCode,
            fullName: user.employeeProfile.fullName,
            avatarUrl: user.employeeProfile.avatarUrl,
            department: user.employeeProfile.department
              ? {
                  id: user.employeeProfile.department.id,
                  name: user.employeeProfile.department.name,
                  code: user.employeeProfile.department.code,
                }
              : null,
            position: user.employeeProfile.position
              ? {
                  id: user.employeeProfile.position.id,
                  name: user.employeeProfile.position.name,
                }
              : null,
          }
        : null,
    };
  }
}
