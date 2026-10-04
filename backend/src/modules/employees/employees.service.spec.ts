import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { AccessScopeService } from '../../common/access/access-scope.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

const makeUser = (overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser => ({
  id: 'actor-user',
  email: 'actor@example.com',
  roleId: 'role-hr',
  role: 'HR_MANAGER',
  permissions: ['employees.update', 'employees.manage_salary'],
  employeeId: 'actor-emp',
  departmentId: 'dept-hr',
  isManagement: false,
  ...overrides,
});

const existingEmployee = (roleName = 'EMPLOYEE') => ({
  id: 'emp-1',
  userId: 'target-user',
  departmentId: 'dept-eng',
  user: { id: 'target-user', email: 'target@example.com', role: { name: roleName } },
  bankInfo: null,
  emergencyContact: null,
});

describe('EmployeesService', () => {
  let prisma: any;
  let service: EmployeesService;

  beforeEach(() => {
    prisma = {
      employeeProfile: { findUnique: jest.fn(), update: jest.fn().mockResolvedValue({ id: 'emp-1' }) },
      user: { findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
      role: { findUnique: jest.fn() },
      department: { findMany: jest.fn().mockResolvedValue([]), updateMany: jest.fn() },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    service = new EmployeesService(prisma, new AccessScopeService(prisma));
  });

  describe('updateEmployee: account changes', () => {
    it('requires roles.manage to change a role', async () => {
      prisma.employeeProfile.findUnique.mockResolvedValue(existingEmployee());

      await expect(
        service.updateEmployee('emp-1', { roleId: 'role-admin' }, makeUser()),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('prevents users from changing their own role', async () => {
      prisma.employeeProfile.findUnique.mockResolvedValue(existingEmployee());

      await expect(
        service.updateEmployee(
          'emp-1',
          { roleId: 'role-x' },
          makeUser({ id: 'target-user', permissions: ['roles.manage'] }),
        ),
      ).rejects.toThrow('You cannot change your own role.');
    });

    it('only lets a Super Admin grant the Super Admin role', async () => {
      prisma.employeeProfile.findUnique.mockResolvedValue(existingEmployee());
      prisma.role.findUnique.mockResolvedValue({ name: 'SUPER_ADMIN' });

      await expect(
        service.updateEmployee('emp-1', { roleId: 'role-super' }, makeUser({ permissions: ['roles.manage'] })),
      ).rejects.toThrow('Only a Super Admin can grant the Super Admin role.');
    });

    it("blocks non-Super Admins from changing a Super Admin's credentials", async () => {
      prisma.employeeProfile.findUnique.mockResolvedValue(existingEmployee('SUPER_ADMIN'));

      await expect(
        service.updateEmployee('emp-1', { password: 'new-password-123' }, makeUser()),
      ).rejects.toThrow(ForbiddenException);
    });

    it('still lets HR reset a regular employee password', async () => {
      prisma.employeeProfile.findUnique.mockResolvedValue(existingEmployee());

      await service.updateEmployee('emp-1', { password: 'new-password-123' }, makeUser());

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'target-user' } }),
      );
    });
  });

  describe('Management department membership', () => {
    it('only lets a Super Admin move someone into Management', async () => {
      prisma.employeeProfile.findUnique.mockResolvedValue({
        ...existingEmployee(),
        department: { code: 'ENG' },
      });
      prisma.department.findUnique = jest.fn().mockResolvedValue({ code: 'MGMT' });

      await expect(
        service.updateEmployee('emp-1', { departmentId: '8b1f2c3d-0000-4000-8000-000000000001' }, makeUser()),
      ).rejects.toThrow('Only a Super Admin can move employees into or out of the Management department.');

      await expect(
        service.updateEmployee(
          'emp-1',
          { departmentId: '8b1f2c3d-0000-4000-8000-000000000001' },
          makeUser({ role: 'SUPER_ADMIN' }),
        ),
      ).resolves.toBeDefined();
    });

    it('stops Management members from moving themselves or others out without Super Admin', async () => {
      prisma.employeeProfile.findUnique.mockResolvedValue({
        ...existingEmployee(),
        department: { code: 'MGMT' },
      });
      prisma.department.findUnique = jest.fn().mockResolvedValue({ code: 'ENG' });

      await expect(
        service.updateEmployee(
          'emp-1',
          { departmentId: '8b1f2c3d-0000-4000-8000-000000000002' },
          makeUser({ isManagement: true }),
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('status and offboarding', () => {
    it('disables login when an employee is marked ENDED, even if the login toggle is on', async () => {
      prisma.employeeProfile.findUnique.mockResolvedValue(existingEmployee());

      await service.updateEmployee('emp-1', { status: 'ENDED', isActive: true }, makeUser());

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'target-user' },
        data: { isActive: false },
      });
    });

    it('offboards instead of deleting: status ENDED and login disabled, records kept', async () => {
      prisma.employeeProfile.findUnique.mockResolvedValue(existingEmployee());

      await service.offboardEmployee('emp-1', makeUser());

      expect(prisma.employeeProfile.update).toHaveBeenCalledWith({
        where: { id: 'emp-1' },
        data: { status: 'ENDED' },
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'target-user' },
        data: { isActive: false },
      });
      expect(prisma.user.delete).not.toHaveBeenCalled();
    });

    it('refuses to offboard your own account or, unless Super Admin, a Super Admin', async () => {
      prisma.employeeProfile.findUnique.mockResolvedValue(existingEmployee());
      await expect(
        service.offboardEmployee('emp-1', makeUser({ id: 'target-user' })),
      ).rejects.toThrow(ForbiddenException);

      prisma.employeeProfile.findUnique.mockResolvedValue(existingEmployee('SUPER_ADMIN'));
      await expect(service.offboardEmployee('emp-1', makeUser())).rejects.toThrow(ForbiddenException);
    });
  });

  describe('salary details', () => {
    it('rejects bank/salary writes without employees.manage_salary', async () => {
      prisma.employeeProfile.findUnique.mockResolvedValue(existingEmployee());

      await expect(
        service.updateEmployee(
          'emp-1',
          { bankInfo: { basicSalary: 9000 } },
          makeUser({ permissions: ['employees.update'] }),
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.employeeProfile.update).not.toHaveBeenCalled();
    });

    it('masks bank details on read without employees.manage_salary', async () => {
      prisma.employeeProfile.findUnique.mockResolvedValue({
        ...existingEmployee(),
        bankInfo: { iban: 'EG00', basicSalary: 9000 },
      });

      const result = await service.getEmployeeById(
        'emp-1',
        makeUser({ role: 'SUPER_ADMIN', permissions: [] }),
      );
      expect(result.bankInfo.iban).toBe('EG00');

      prisma.employeeProfile.findUnique.mockResolvedValue({
        ...existingEmployee(),
        bankInfo: { iban: 'EG00', basicSalary: 9000 },
      });
      const masked = await service.getEmployeeById('emp-1', makeUser({ permissions: [] }));
      expect(masked.bankInfo).toEqual(expect.objectContaining({ isMasked: true }));
    });
  });

  describe('getEmployeeById scope', () => {
    const agent = makeUser({ id: 'agent-user', role: 'EMPLOYEE', permissions: ['employees.view'] });

    it('hides profiles outside the directory scope', async () => {
      prisma.employeeProfile.findUnique
        // target profile
        .mockResolvedValueOnce({ ...existingEmployee(), departmentId: 'dept-sales' })
        // requesting agent's own profile (scope lookup)
        .mockResolvedValueOnce({
          id: 'agent-emp',
          departmentId: 'dept-eng',
          department: { code: 'ENG', name: 'Engineering' },
          position: { name: 'Developer' },
        });

      await expect(service.getEmployeeById('emp-1', agent)).rejects.toThrow(NotFoundException);
    });

    const colleagueProfile = () => ({
      ...existingEmployee(),
      fullName: 'Sara Ali',
      employeeCode: 'TAR0007',
      avatarUrl: null,
      phone: '01000000000',
      address: 'Cairo',
      dob: new Date('1995-01-01'),
      department: { id: 'dept-eng', name: 'Engineering', code: 'ENG' },
      position: { id: 'pos-1', name: 'Developer' },
      user: { id: 'target-user', email: 'sara@example.com', isActive: true },
    });
    const agentOwnProfile = {
      id: 'agent-emp',
      departmentId: 'dept-eng',
      department: { code: 'ENG', name: 'Engineering' },
      position: { name: 'Developer' },
    };

    it('shows a same-department colleague as a card without personal details', async () => {
      prisma.employeeProfile.findUnique
        .mockResolvedValueOnce(colleagueProfile())
        .mockResolvedValueOnce(agentOwnProfile);

      const result: any = await service.getEmployeeById('emp-1', agent);

      expect(result).toEqual({
        id: 'emp-1',
        employeeCode: 'TAR0007',
        fullName: 'Sara Ali',
        avatarUrl: null,
        department: { id: 'dept-eng', name: 'Engineering', code: 'ENG' },
        position: { id: 'pos-1', name: 'Developer' },
        user: { id: 'target-user', email: 'sara@example.com' },
        isLimitedView: true,
      });
      expect(result.phone).toBeUndefined();
    });

    it('shows the full profile to the Team Leader of that department', async () => {
      const leader = makeUser({ id: 'tl-user', role: 'TEAM_LEADER', employeeId: 'tl-emp', departmentId: 'dept-eng', permissions: ['employees.view'] });
      prisma.employeeProfile.findUnique
        .mockResolvedValueOnce(colleagueProfile())
        .mockResolvedValueOnce({ ...agentOwnProfile, id: 'tl-emp', position: { name: 'Team Leader' } });

      const result: any = await service.getEmployeeById('emp-1', leader);

      expect(result.phone).toBe('01000000000');
      expect(result.isLimitedView).toBeUndefined();
    });

    it('always shows the requester their own profile', async () => {
      prisma.employeeProfile.findUnique.mockResolvedValueOnce({
        ...existingEmployee(),
        userId: 'agent-user',
        departmentId: 'dept-sales',
      });

      await expect(service.getEmployeeById('emp-1', agent)).resolves.toBeDefined();
      expect(prisma.employeeProfile.findUnique).toHaveBeenCalledTimes(1);
    });
  });
});
