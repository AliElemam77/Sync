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
      user: { findUnique: jest.fn(), update: jest.fn() },
      role: { findUnique: jest.fn() },
      department: { findMany: jest.fn(), updateMany: jest.fn() },
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

    it('shows colleagues in the same department', async () => {
      prisma.employeeProfile.findUnique
        .mockResolvedValueOnce(existingEmployee())
        .mockResolvedValueOnce({
          id: 'agent-emp',
          departmentId: 'dept-eng',
          department: { code: 'ENG', name: 'Engineering' },
          position: { name: 'Developer' },
        });

      await expect(service.getEmployeeById('emp-1', agent)).resolves.toEqual(
        expect.objectContaining({ id: 'emp-1' }),
      );
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
