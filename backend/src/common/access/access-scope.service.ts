import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

const HR_ADMIN_ROLES = ['SUPER_ADMIN', 'HR_MANAGER'];

/** Department whose members have full access to every module (Super Admin aside) */
export const MANAGEMENT_DEPARTMENT_CODE = 'MGMT';

/** Filter usable in both LeaveRequest and PermissionRequest where clauses */
export type RequestVisibilityFilter =
  | { employeeId: string }
  | { employee: { departmentId: { in: string[] } } };

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

  /**
   * Management department members see and operate every module. Actions reserved to the
   * Super Admin (granting Super Admin, managing Super Admin accounts, changing who belongs to
   * Management) stay reserved.
   */
  isManagement(user: AuthenticatedUser): boolean {
    return user.isManagement;
  }

  /** Same semantics as PermissionsGuard: Super Admin and Management implicitly hold every permission */
  hasPermission(user: AuthenticatedUser, permission: string): boolean {
    return this.isSuperAdmin(user) || this.isManagement(user) || user.permissions.includes(permission);
  }

  /** Company-wide authority: attendance/leave/permission scope and approvals, task administration */
  isHrAdmin(user: AuthenticatedUser): boolean {
    return HR_ADMIN_ROLES.includes(user.role) || this.isManagement(user);
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
   * Departments whose leave and permission requests the user may approve; null means every
   * department. HR decides for anyone, a Team Leader for their own department and a department
   * head for the departments they manage.
   */
  async getApprovalDepartmentIds(user: AuthenticatedUser): Promise<string[] | null> {
    if (this.isHrAdmin(user)) return null;
    return this.getLedDepartmentIds(user);
  }

  /**
   * Departments whose employees the user may give a bonus to; null means every department.
   * Management (and the Super Admin) give bonuses to anyone, Team Leaders and heads to the
   * departments they lead. HR does not give bonuses; it can cancel them.
   */
  async getBonusDepartmentIds(user: AuthenticatedUser): Promise<string[] | null> {
    if (this.isSuperAdmin(user) || this.isManagement(user)) return null;
    return this.getLedDepartmentIds(user);
  }

  /** A Team Leader's own department plus every department the user heads */
  private async getLedDepartmentIds(user: AuthenticatedUser): Promise<string[]> {
    const departmentIds = new Set<string>();
    if (this.isTeamLeader(user) && user.departmentId) {
      departmentIds.add(user.departmentId);
    }
    if (user.employeeId) {
      const managed = await this.prisma.department.findMany({
        where: { headId: user.employeeId },
        select: { id: true },
      });
      managed.forEach((d) => departmentIds.add(d.id));
    }
    return [...departmentIds];
  }

  /**
   * Which leave/permission requests the user may see: null for all (HR); otherwise their own plus
   * those of the departments they approve. An empty list means none.
   */
  async getRequestVisibility(user: AuthenticatedUser): Promise<RequestVisibilityFilter[] | null> {
    const approvalDepartments = await this.getApprovalDepartmentIds(user);
    if (approvalDepartments === null) return null;

    const visible: RequestVisibilityFilter[] = [];
    if (user.employeeId) visible.push({ employeeId: user.employeeId });
    if (approvalDepartments.length > 0) {
      visible.push({ employee: { departmentId: { in: approvalDepartments } } });
    }
    return visible;
  }

  /** Whether the user may approve or reject a request filed by this employee (never their own) */
  async canDecideRequestOf(
    user: AuthenticatedUser,
    requester: { id: string; departmentId: string },
  ): Promise<boolean> {
    if (requester.id === user.employeeId && !this.isSuperAdmin(user)) return false;
    const scope = await this.getApprovalDepartmentIds(user);
    return scope === null || scope.includes(requester.departmentId);
  }

  /**
   * Departments whose employees the user may see in the directory; null means the whole company.
   * Company-wide access also follows from belonging to an HR or management department, and heads
   * see every department they manage. Department and position names are matched heuristically.
   */
  async resolveDirectoryScope(user: AuthenticatedUser): Promise<string[] | null> {
    const roleName = user.role?.toUpperCase() || '';
    if (DIRECTORY_COMPANY_WIDE_ROLES.includes(roleName) || this.isManagement(user)) return null;

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
