import { AccessScopeService } from './access-scope.service';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

const makeUser = (overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser => ({
  id: 'user-1',
  email: 'user@example.com',
  roleId: 'role-1',
  role: 'EMPLOYEE',
  permissions: [],
  employeeId: 'emp-1',
  departmentId: 'dept-1',
  isManagement: false,
  ...overrides,
});

describe('AccessScopeService', () => {
  const prisma = {
    employeeProfile: { findUnique: jest.fn() },
    department: { findMany: jest.fn() },
  };
  const access = new AccessScopeService(prisma as any);

  beforeEach(() => jest.resetAllMocks());

  describe('role helpers', () => {
    it('treats SUPER_ADMIN as holding every permission', () => {
      expect(access.hasPermission(makeUser({ role: 'SUPER_ADMIN' }), 'payroll.manage')).toBe(true);
      expect(access.hasPermission(makeUser(), 'payroll.manage')).toBe(false);
      expect(access.hasPermission(makeUser({ permissions: ['payroll.manage'] }), 'payroll.manage')).toBe(true);
    });

    it('limits HR admin authority to SUPER_ADMIN and HR_MANAGER', () => {
      expect(access.isHrAdmin(makeUser({ role: 'HR_MANAGER' }))).toBe(true);
      expect(access.isHrAdmin(makeUser({ role: 'SUPER_ADMIN' }))).toBe(true);
      expect(access.isHrAdmin(makeUser({ role: 'GENERAL_MANAGER' }))).toBe(false);
    });

    it('grants task leadership to TEAM_LEADER or org.manage holders', () => {
      expect(access.isTaskLeader(makeUser({ role: 'TEAM_LEADER' }))).toBe(true);
      expect(access.isTaskLeader(makeUser({ permissions: ['org.manage'] }))).toBe(true);
      expect(access.isTaskLeader(makeUser())).toBe(false);
    });

    it('identifies regular agents', () => {
      expect(access.isAgent(makeUser())).toBe(true);
      expect(access.isAgent(makeUser({ permissions: ['org.manage'] }))).toBe(false);
      expect(access.isAgent(makeUser({ role: 'TEAM_LEADER' }))).toBe(false);
    });
  });

  describe('Management department', () => {
    const manager = makeUser({ isManagement: true });

    it('holds every permission and company-wide authority', async () => {
      expect(access.hasPermission(manager, 'accounting.manage')).toBe(true);
      expect(access.isHrAdmin(manager)).toBe(true);
      await expect(access.getApprovalDepartmentIds(manager)).resolves.toBeNull();
      await expect(access.resolveDirectoryScope(manager)).resolves.toBeNull();
    });

    it('is not a Super Admin and cannot decide its own requests', async () => {
      expect(access.isSuperAdmin(manager)).toBe(false);
      await expect(
        access.canDecideRequestOf(manager, { id: 'emp-1', departmentId: 'dept-mgmt' }),
      ).resolves.toBe(false);
    });
  });

  describe('approval scope', () => {
    it('lets HR approve for every department', async () => {
      await expect(access.getApprovalDepartmentIds(makeUser({ role: 'HR_MANAGER' }))).resolves.toBeNull();
    });

    it('combines a Team Leader’s own department with departments they head', async () => {
      prisma.department.findMany.mockResolvedValue([{ id: 'dept-qa' }]);
      await expect(
        access.getApprovalDepartmentIds(makeUser({ role: 'TEAM_LEADER', departmentId: 'dept-eng' })),
      ).resolves.toEqual(['dept-eng', 'dept-qa']);
    });

    it('gives regular employees no approval scope', async () => {
      prisma.department.findMany.mockResolvedValue([]);
      await expect(access.getApprovalDepartmentIds(makeUser())).resolves.toEqual([]);
    });

    it('limits request visibility to own requests plus approved departments', async () => {
      prisma.department.findMany.mockResolvedValue([]);
      await expect(
        access.getRequestVisibility(makeUser({ role: 'TEAM_LEADER', departmentId: 'dept-eng' })),
      ).resolves.toEqual([
        { employeeId: 'emp-1' },
        { employee: { departmentId: { in: ['dept-eng'] } } },
      ]);
    });

    it('never lets anyone but a Super Admin decide their own request', async () => {
      const own = { id: 'emp-1', departmentId: 'dept-hr' };
      await expect(access.canDecideRequestOf(makeUser({ role: 'HR_MANAGER' }), own)).resolves.toBe(false);
      await expect(access.canDecideRequestOf(makeUser({ role: 'SUPER_ADMIN' }), own)).resolves.toBe(true);
    });
  });

  describe('resolveDirectoryScope', () => {
    it('gives company-wide roles the whole company without querying', async () => {
      await expect(access.resolveDirectoryScope(makeUser({ role: 'GENERAL_MANAGER' }))).resolves.toBeNull();
      expect(prisma.employeeProfile.findUnique).not.toHaveBeenCalled();
    });

    it('gives HR department members the whole company', async () => {
      prisma.employeeProfile.findUnique.mockResolvedValue({
        id: 'emp-1',
        departmentId: 'dept-hr',
        department: { code: 'HR', name: 'Human Resources' },
        position: { name: 'Specialist' },
      });
      await expect(access.resolveDirectoryScope(makeUser())).resolves.toBeNull();
    });

    it('scopes heads to their own and managed departments', async () => {
      prisma.employeeProfile.findUnique.mockResolvedValue({
        id: 'emp-1',
        departmentId: 'dept-eng',
        department: { code: 'ENG', name: 'Engineering' },
        position: { name: 'Head of Engineering' },
      });
      prisma.department.findMany.mockResolvedValue([{ id: 'dept-eng' }, { id: 'dept-qa' }]);

      await expect(access.resolveDirectoryScope(makeUser())).resolves.toEqual(['dept-eng', 'dept-qa']);
    });

    it('scopes other employees to their own department', async () => {
      prisma.employeeProfile.findUnique.mockResolvedValue({
        id: 'emp-1',
        departmentId: 'dept-eng',
        department: { code: 'ENG', name: 'Engineering' },
        position: { name: 'Developer' },
      });
      await expect(access.resolveDirectoryScope(makeUser())).resolves.toEqual(['dept-eng']);
    });

    it('returns an empty scope when the user has no employee profile', async () => {
      prisma.employeeProfile.findUnique.mockResolvedValue(null);
      await expect(access.resolveDirectoryScope(makeUser())).resolves.toEqual([]);
    });
  });
});
