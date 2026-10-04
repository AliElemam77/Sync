import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

const HR_ADMIN_ROLES = ['SUPER_ADMIN', 'HR_MANAGER'];

const DIRECTORY_COMPANY_WIDE_ROLES = [
  'SUPER_ADMIN',
  'ADMIN',
  'HR_MANAGER',
  'GENERAL_MANAGER',
  'EXECUTIVE_MANAGER',
  'DIRECTOR',
];

/**
 * Single home for role and scope rules. Each method reproduces the behaviour the modules had
 * before it was centralised; business-rule changes (who approves, who sees whom) belong here.
 */
@Injectable()
export class AccessScopeService {
  constructor(private readonly prisma: PrismaService) {}

  isSuperAdmin(user: AuthenticatedUser): boolean {
    return user.role === 'SUPER_ADMIN';
  }

  /** Same semantics as PermissionsGuard: Super Admin implicitly holds every permission */
  hasPermission(user: AuthenticatedUser, permission: string): boolean {
    return this.isSuperAdmin(user) || user.permissions.includes(permission);
  }

  /** Company-wide HR authority: attendance/leave/permission scope and approvals, task administration */
  isHrAdmin(user: AuthenticatedUser): boolean {
    return HR_ADMIN_ROLES.includes(user.role);
  }

  isTeamLeader(user: AuthenticatedUser): boolean {
    return user.role === 'TEAM_LEADER';
  }

  /** Task leadership: the Team Leader role or the org.manage permission */
  isTaskLeader(user: AuthenticatedUser): boolean {
    return this.isTeamLeader(user) || user.permissions.includes('org.manage');
  }

  /** Regular agent for task-routing rules */
  isAgent(user: AuthenticatedUser): boolean {
    return user.role === 'EMPLOYEE' && !user.permissions.includes('org.manage');
  }

  /**
   * Departments whose employees the user may see in the directory; null means the whole company.
   * Company-wide access also follows from belonging to an HR or management department, and heads
   * see every department they manage. Department and position names are matched heuristically.
   */
  async resolveDirectoryScope(user: AuthenticatedUser): Promise<string[] | null> {
    const roleName = user.role?.toUpperCase() || '';
    if (DIRECTORY_COMPANY_WIDE_ROLES.includes(roleName)) return null;

    const actorEmployee = await this.prisma.employeeProfile.findUnique({
      where: { userId: user.id },
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

    if (isHR || isMgmt) return null;

    if (!actorEmployee?.id) return [];

    const posName = actorEmployee.position?.name?.toLowerCase() || '';
    const isHead =
      roleName.includes('HEAD') ||
      posName.includes('head') ||
      posName.includes('رئيس') ||
      posName.includes('مدير إدارة');

    if (isHead) {
      // A Head oversees their home department plus every department they manage as headId
      const managedDepts = await this.prisma.department.findMany({
        where: {
          OR: [{ headId: actorEmployee.id }, { id: actorEmployee.departmentId }],
        },
        select: { id: true },
      });
      return managedDepts.map((d) => d.id);
    }

    // Team Leaders and Agents see their own department
    return [actorEmployee.departmentId];
  }
}
