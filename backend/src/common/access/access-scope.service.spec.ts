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
