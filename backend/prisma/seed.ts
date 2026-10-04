import { PrismaClient, ShiftType, Gender, EmploymentType, EmployeeStatus, EmergencyRelationship } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const INITIAL_PERMISSIONS = [
  // User & RBAC Management
  { name: 'users.view', module: 'AUTH', description: 'View system users' },
  { name: 'users.create', module: 'AUTH', description: 'Create new users' },
  { name: 'users.update', module: 'AUTH', description: 'Update existing users' },
  { name: 'users.delete', module: 'AUTH', description: 'Delete users' },
  { name: 'roles.manage', module: 'AUTH', description: 'Manage roles and permissions' },

  // Organization Structure (PHASE 02)
  { name: 'org.view', module: 'ORGANIZATION', description: 'View organizational hierarchy' },
  { name: 'org.manage', module: 'ORGANIZATION', description: 'Manage departments, positions, and levels' },

  // Employee Directory (PHASE 03)
  { name: 'employees.view', module: 'EMPLOYEES', description: 'View employee directory' },
  { name: 'employees.create', module: 'EMPLOYEES', description: 'Create new employee profiles and credentials' },
  { name: 'employees.update', module: 'EMPLOYEES', description: 'Update employee profiles' },
  { name: 'employees.delete', module: 'EMPLOYEES', description: 'Delete employee records' },
  { name: 'employees.manage_salary', module: 'EMPLOYEES', description: 'View and manage sensitive bank and salary details' },

  // Attendance & Leave
  { name: 'attendance.view', module: 'ATTENDANCE', description: 'View attendance logs' },
  { name: 'attendance.manage', module: 'ATTENDANCE', description: 'Approve or edit attendance' },
  { name: 'leaves.request', module: 'LEAVES', description: 'Submit leave requests' },
  { name: 'leaves.approve', module: 'LEAVES', description: 'Approve leave requests' },

  // Tasks Management (PHASE 04)
  { name: 'tasks.view', module: 'TASKS', description: 'View assigned and department tasks' },
  { name: 'tasks.create', module: 'TASKS', description: 'Create and assign new tasks' },
  { name: 'tasks.update', module: 'TASKS', description: 'Edit task details or advance task status' },
  { name: 'tasks.delete', module: 'TASKS', description: 'Delete tasks' },

  // IT Asset Management (PHASE 09)
  { name: 'it.manage_assets', module: 'ASSETS', description: 'Manage hardware, software licenses, and employee asset custody' },
  { name: 'assets.view', module: 'ASSETS', description: 'View company assets and assigned equipment' },

  // Accounting & Finance (PHASE 10)
  { name: 'accounting.view', module: 'ACCOUNTING', description: 'View financial ledger, income, expenses, and summary reports' },
  { name: 'accounting.manage', module: 'ACCOUNTING', description: 'Book financial transactions, record payroll/asset costs, and perform reversals' },

  // Payroll & Compensation (PHASE 06)
  { name: 'payroll.view', module: 'PAYROLL', description: 'View payroll cycles and company payslips' },
  { name: 'payroll.manage', module: 'PAYROLL', description: 'Generate monthly payroll, calculate penalties, and approve cycles' },
  { name: 'payroll.self', module: 'PAYROLL', description: 'View own payslips and salary breakdown' },

  // Audit Logs
  { name: 'audit.view', module: 'AUDIT', description: 'Inspect audit trail logs' },
];

// Seed credentials must come from the environment; never commit default passwords
function requireEnv(name: string): string {
  const value = process.env[name]?.replace(/^["']|["']$/g, '').trim();
  if (!value) {
    throw new Error(`${name} must be set in backend/.env before running the seed.`);
  }
  return value;
}

async function main() {
  console.log('--- Starting Database Seeding ---');

  // 1. Seed Permissions (Upsert to maintain idempotency)
  console.log('Seeding permissions...');
  const createdPermissions = await Promise.all(
    INITIAL_PERMISSIONS.map((perm) =>
      prisma.permission.upsert({
        where: { name: perm.name },
        update: { module: perm.module, description: perm.description },
        create: perm,
      }),
    ),
  );

  // 2. Seed Super Admin Role
  console.log('Seeding SUPER_ADMIN role...');
  const superAdminRole = await prisma.role.upsert({
    where: { name: 'SUPER_ADMIN' },
    update: {},
    create: {
      name: 'SUPER_ADMIN',
      description: 'System owner with full unconstrained access',
      isSystem: true,
    },
  });

  // 3. Seed Standard Roles
  const hrManagerRole = await prisma.role.upsert({
    where: { name: 'HR_MANAGER' },
    update: {},
    create: {
      name: 'HR_MANAGER',
      description: 'Human Resources operations and organization management',
      isSystem: true,
    },
  });

  const employeeRole = await prisma.role.upsert({
    where: { name: 'EMPLOYEE' },
    update: {},
    create: {
      name: 'EMPLOYEE',
      description: 'Standard employee with self-service portal access',
      isSystem: true,
    },
  });

  const teamLeaderRole = await prisma.role.upsert({
    where: { name: 'TEAM_LEADER' },
    update: {},
    create: {
      name: 'TEAM_LEADER',
      description: 'Department team leader with task distribution and review authority',
      isSystem: true,
    },
  });

  // 4. Attach all permissions to SUPER_ADMIN
  console.log('Assigning full permissions to SUPER_ADMIN...');
  await prisma.rolePermission.deleteMany({
    where: { roleId: superAdminRole.id },
  });

  await prisma.rolePermission.createMany({
    data: createdPermissions.map((perm) => ({
      roleId: superAdminRole.id,
      permissionId: perm.id,
    })),
    skipDuplicates: true,
  });

  // 5. Attach scoped permissions to HR_MANAGER & EMPLOYEE
  const hrPerms = createdPermissions.filter((p) =>
    ['ORGANIZATION', 'EMPLOYEES', 'ATTENDANCE', 'LEAVES', 'TASKS', 'PAYROLL'].includes(p.module),
  );
  await prisma.rolePermission.createMany({
    data: hrPerms.map((p) => ({ roleId: hrManagerRole.id, permissionId: p.id })),
    skipDuplicates: true,
  });

  const empPerms = createdPermissions.filter((p) =>
    ['leaves.request', 'attendance.view', 'org.view', 'employees.view', 'tasks.view', 'tasks.create', 'tasks.update', 'payroll.self'].includes(p.name),
  );
  await prisma.rolePermission.createMany({
    data: empPerms.map((p) => ({ roleId: employeeRole.id, permissionId: p.id })),
    skipDuplicates: true,
  });

  const leadPerms = createdPermissions.filter((p) =>
    ['leaves.request', 'attendance.view', 'org.view', 'employees.view', 'tasks.view', 'tasks.create', 'tasks.update', 'payroll.self'].includes(p.name),
  );
  await prisma.rolePermission.createMany({
    data: leadPerms.map((p) => ({ roleId: teamLeaderRole.id, permissionId: p.id })),
    skipDuplicates: true,
  });

  // 6. Seed Default Super Admin User
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@sync-erp.local').toLowerCase().trim();
  const passwordHash = await bcrypt.hash(requireEnv('ADMIN_PASSWORD'), 12);
  const demoEmployeePasswordHash = await bcrypt.hash(requireEnv('SEED_EMPLOYEE_PASSWORD'), 12);

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      passwordHash,
      isActive: true,
      roleId: superAdminRole.id,
    },
    create: {
      email: adminEmail,
      passwordHash,
      isActive: true,
      roleId: superAdminRole.id,
    },
  });

  console.log(`Default Super Admin verified: ${adminUser.email}`);

  // 7. Seed Initial Organization Structure
  console.log('Seeding initial Organization Hierarchy...');
  
  const engDept = await prisma.department.upsert({
    where: { code: 'ENG' },
    update: { name: 'Engineering & Technology' },
    create: {
      name: 'Engineering & Technology',
      code: 'ENG',
      description: 'Core software engineering and infrastructure',
    },
  });

  const hrDept = await prisma.department.upsert({
    where: { code: 'HR' },
    update: { name: 'Human Resources & People Operations' },
    create: {
      name: 'Human Resources & People Operations',
      code: 'HR',
      description: 'Talent management and employee relations',
    },
  });

  const uiDept = await prisma.department.upsert({
    where: { code: 'UI' },
    update: { name: 'UI / UX Design' },
    create: {
      name: 'UI / UX Design',
      code: 'UI',
      description: 'Product design, creative assets, and interface design',
    },
  });

  const adminPos = await prisma.position.upsert({
    where: {
      departmentId_name: {
        departmentId: engDept.id,
        name: 'System Administrator',
      },
    },
    update: {},
    create: {
      name: 'System Administrator',
      departmentId: engDept.id,
      description: 'System owner and executive administrator',
    },
  });

  await prisma.employeeProfile.upsert({
    where: { employeeCode: 'TAR0000' },
    update: {
      userId: adminUser.id,
      departmentId: engDept.id,
      positionId: adminPos.id,
    },
    create: {
      userId: adminUser.id,
      employeeCode: 'TAR0000',
      fullName: 'System Administrator',
      phone: '+20 100 000 0000',
      gender: Gender.MALE,
      shiftType: ShiftType.RS,
      monthlyPermissionHours: 4,
      annualLeaveDays: 30,
      company: 'Tawfeer',
      branch: 'Cairo HQ',
      departmentId: engDept.id,
      positionId: adminPos.id,
      joiningDate: new Date('2023-01-01'),
      employmentType: EmploymentType.FULL_TIME,
      status: EmployeeStatus.ACTIVE,
    },
  });

  const swEngPos = await prisma.position.upsert({
    where: {
      departmentId_name: {
        departmentId: engDept.id,
        name: 'Full-Stack Software Engineer',
      },
    },
    update: {},
    create: {
      name: 'Full-Stack Software Engineer',
      departmentId: engDept.id,
      description: 'Builds and maintains enterprise cloud applications',
    },
  });

  const swSeniorLevel = await prisma.level.upsert({
    where: {
      positionId_name: {
        positionId: swEngPos.id,
        name: 'Senior Engineer (L3)',
      },
    },
    update: { rank: 3 },
    create: {
      name: 'Senior Engineer (L3)',
      rank: 3,
      positionId: swEngPos.id,
    },
  });

  // 8. Seed Initial Sample Employee (TAR0001)
  console.log('Seeding sample employee (TAR0001)...');
  const sampleUserEmail = 'ahmed.mansour@sync-erp.local';
  const sampleUser = await prisma.user.upsert({
    where: { email: sampleUserEmail },
    update: { roleId: employeeRole.id },
    create: {
      email: sampleUserEmail,
      passwordHash: demoEmployeePasswordHash,
      isActive: true,
      roleId: employeeRole.id,
    },
  });

  const sampleEmp = await prisma.employeeProfile.upsert({
    where: { employeeCode: 'TAR0001' },
    update: {
      userId: sampleUser.id,
      departmentId: engDept.id,
      positionId: swEngPos.id,
      levelId: swSeniorLevel.id,
    },
    create: {
      userId: sampleUser.id,
      employeeCode: 'TAR0001',
      fullName: 'Ahmed Mansour',
      phone: '+20 100 123 4567',
      gender: Gender.MALE,
      shiftType: ShiftType.RS,
      monthlyPermissionHours: 4,
      annualLeaveDays: 21,
      company: 'Tawfeer',
      branch: 'Cairo HQ',
      departmentId: engDept.id,
      positionId: swEngPos.id,
      levelId: swSeniorLevel.id,
      joiningDate: new Date('2024-01-15'),
      employmentType: EmploymentType.FULL_TIME,
      status: EmployeeStatus.ACTIVE,
      address: 'Nasr City, Cairo, Egypt',
      altPhone: '+20 111 987 6543',
    },
  });

  // 9. Assign Head to Engineering Department
  await prisma.department.update({
    where: { id: engDept.id },
    data: { headId: sampleEmp.id },
  });

  // 9. Seed UI/UX Positions & Levels
  const uiLeadPos = await prisma.position.upsert({
    where: {
      departmentId_name: {
        departmentId: uiDept.id,
        name: 'Lead UI/UX Designer',
      },
    },
    update: {},
    create: {
      name: 'Lead UI/UX Designer',
      departmentId: uiDept.id,
      description: 'Leads design sprints, design systems, and creative direction',
    },
  });

  const uiDesignerPos = await prisma.position.upsert({
    where: {
      departmentId_name: {
        departmentId: uiDept.id,
        name: 'UI/UX Designer',
      },
    },
    update: {},
    create: {
      name: 'UI/UX Designer',
      departmentId: uiDept.id,
      description: 'Designs UI interfaces, mobile screens, and design components',
    },
  });

  // 10. Seed Demo User 1: Engineering Agent (Omar Khaled)
  console.log('Seeding Engineering Agent (Omar Khaled - TAR0002)...');
  const omarUser = await prisma.user.upsert({
    where: { email: 'omar.khaled@sync-erp.local' },
    update: { roleId: employeeRole.id },
    create: {
      email: 'omar.khaled@sync-erp.local',
      passwordHash: demoEmployeePasswordHash,
      isActive: true,
      roleId: employeeRole.id,
    },
  });

  await prisma.employeeProfile.upsert({
    where: { employeeCode: 'TAR0002' },
    update: {
      userId: omarUser.id,
      departmentId: engDept.id,
      positionId: swEngPos.id,
    },
    create: {
      userId: omarUser.id,
      employeeCode: 'TAR0002',
      fullName: 'Omar Khaled',
      phone: '+20 101 234 5678',
      gender: Gender.MALE,
      shiftType: ShiftType.RS,
      monthlyPermissionHours: 4,
      annualLeaveDays: 21,
      company: 'Tawfeer',
      branch: 'Cairo HQ',
      departmentId: engDept.id,
      positionId: swEngPos.id,
      joiningDate: new Date('2024-02-01'),
      employmentType: EmploymentType.FULL_TIME,
      status: EmployeeStatus.ACTIVE,
    },
  });

  // 11. Seed Demo User 2: UI Team Leader (Sara Nabil)
  console.log('Seeding UI Team Leader (Sara Nabil - TAR0003)...');
  const saraUser = await prisma.user.upsert({
    where: { email: 'sara.nabil@sync-erp.local' },
    update: { roleId: teamLeaderRole.id },
    create: {
      email: 'sara.nabil@sync-erp.local',
      passwordHash: demoEmployeePasswordHash,
      isActive: true,
      roleId: teamLeaderRole.id,
    },
  });

  await prisma.employeeProfile.upsert({
    where: { employeeCode: 'TAR0003' },
    update: {
      userId: saraUser.id,
      departmentId: uiDept.id,
      positionId: uiLeadPos.id,
    },
    create: {
      userId: saraUser.id,
      employeeCode: 'TAR0003',
      fullName: 'Sara Nabil',
      phone: '+20 102 345 6789',
      gender: Gender.FEMALE,
      shiftType: ShiftType.LS,
      monthlyPermissionHours: 4,
      annualLeaveDays: 30,
      company: 'Tawfeer',
      branch: 'Cairo HQ',
      departmentId: uiDept.id,
      positionId: uiLeadPos.id,
      joiningDate: new Date('2023-06-01'),
      employmentType: EmploymentType.FULL_TIME,
      status: EmployeeStatus.ACTIVE,
    },
  });

  // 12. Seed Demo User 3: UI Design Agent (Karim Tarek)
  console.log('Seeding UI Design Agent (Karim Tarek - TAR0004)...');
  const karimUser = await prisma.user.upsert({
    where: { email: 'karim.tarek@sync-erp.local' },
    update: { roleId: employeeRole.id },
    create: {
      email: 'karim.tarek@sync-erp.local',
      passwordHash: demoEmployeePasswordHash,
      isActive: true,
      roleId: employeeRole.id,
    },
  });

  await prisma.employeeProfile.upsert({
    where: { employeeCode: 'TAR0004' },
    update: {
      userId: karimUser.id,
      departmentId: uiDept.id,
      positionId: uiDesignerPos.id,
    },
    create: {
      userId: karimUser.id,
      employeeCode: 'TAR0004',
      fullName: 'Karim Tarek',
      phone: '+20 103 456 7890',
      gender: Gender.MALE,
      shiftType: ShiftType.LS,
      monthlyPermissionHours: 4,
      annualLeaveDays: 30,
      company: 'Tawfeer',
      branch: 'Cairo HQ',
      departmentId: uiDept.id,
      positionId: uiDesignerPos.id,
      joiningDate: new Date('2024-03-15'),
      employmentType: EmploymentType.FULL_TIME,
      status: EmployeeStatus.ACTIVE,
    },
  });

  // 13. Seed Salary Profiles (PHASE 06: Compensation Structure)
  console.log('Seeding employee SalaryProfiles...');
  const allEmployees = await prisma.employeeProfile.findMany();
  const salaryMap: Record<string, { base: number; housing: number; transport: number; taxRate: number }> = {
    TAR0000: { base: 25000, housing: 5000, transport: 2500, taxRate: 10 },
    TAR0001: { base: 18000, housing: 3500, transport: 2000, taxRate: 10 },
    TAR0002: { base: 14000, housing: 2500, transport: 1500, taxRate: 10 },
    TAR0003: { base: 16000, housing: 3000, transport: 2000, taxRate: 10 },
    TAR0004: { base: 12000, housing: 2000, transport: 1500, taxRate: 10 },
  };

  for (const emp of allEmployees) {
    const config = salaryMap[emp.employeeCode] || { base: 10000, housing: 1500, transport: 1000, taxRate: 10 };
    await prisma.salaryProfile.upsert({
      where: { employeeId: emp.id },
      update: {
        baseSalary: config.base,
        housingAllowance: config.housing,
        transportAllowance: config.transport,
        taxRate: config.taxRate,
      },
      create: {
        employeeId: emp.id,
        baseSalary: config.base,
        housingAllowance: config.housing,
        transportAllowance: config.transport,
        taxRate: config.taxRate,
      },
    });
  }

  // 14. Seed Sample Attendance Records with Delays for Phase 05 -> 06 Coupling
  console.log('Seeding sample attendance records with delays for September 2026...');
  const omarProfile = allEmployees.find((e) => e.employeeCode === 'TAR0002');
  if (omarProfile) {
    // 45 mins delay on Sept 02
    await prisma.attendanceRecord.upsert({
      where: {
        employeeId_date: {
          employeeId: omarProfile.id,
          date: new Date('2026-09-02T00:00:00.000Z'),
        },
      },
      update: {
        delayMinutes: 45,
        status: 'PRESENT' as any,
      },
      create: {
        employeeId: omarProfile.id,
        date: new Date('2026-09-02T00:00:00.000Z'),
        checkInTime: new Date('2026-09-02T09:45:00.000Z'),
        checkOutTime: new Date('2026-09-02T17:00:00.000Z'),
        status: 'PRESENT' as any,
        delayMinutes: 45,
        overtimeMinutes: 0,
      },
    });

    // 30 mins delay on Sept 03
    await prisma.attendanceRecord.upsert({
      where: {
        employeeId_date: {
          employeeId: omarProfile.id,
          date: new Date('2026-09-03T00:00:00.000Z'),
        },
      },
      update: {
        delayMinutes: 30,
        status: 'PRESENT' as any,
      },
      create: {
        employeeId: omarProfile.id,
        date: new Date('2026-09-03T00:00:00.000Z'),
        checkInTime: new Date('2026-09-03T09:30:00.000Z'),
        checkOutTime: new Date('2026-09-03T17:00:00.000Z'),
        status: 'PRESENT' as any,
        delayMinutes: 30,
        overtimeMinutes: 0,
      },
    });
  }

  const karimProfile = allEmployees.find((e) => e.employeeCode === 'TAR0004');
  if (karimProfile) {
    // 60 mins delay on Sept 01
    await prisma.attendanceRecord.upsert({
      where: {
        employeeId_date: {
          employeeId: karimProfile.id,
          date: new Date('2026-09-01T00:00:00.000Z'),
        },
      },
      update: {
        delayMinutes: 60,
        status: 'PRESENT' as any,
      },
      create: {
        employeeId: karimProfile.id,
        date: new Date('2026-09-01T00:00:00.000Z'),
        checkInTime: new Date('2026-09-01T10:00:00.000Z'),
        checkOutTime: new Date('2026-09-01T17:00:00.000Z'),
        status: 'PRESENT' as any,
        delayMinutes: 60,
        overtimeMinutes: 0,
      },
    });
  }

  console.log('--- Database Seeding Complete ---');
}

main()
  .catch((e) => {
    console.error('Seeding failure:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
