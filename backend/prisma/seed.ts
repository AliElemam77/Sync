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

  // Audit Logs
  { name: 'audit.view', module: 'AUDIT', description: 'Inspect audit trail logs' },
];

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
    ['ORGANIZATION', 'EMPLOYEES', 'ATTENDANCE', 'LEAVES'].includes(p.module),
  );
  await prisma.rolePermission.createMany({
    data: hrPerms.map((p) => ({ roleId: hrManagerRole.id, permissionId: p.id })),
    skipDuplicates: true,
  });

  const empPerms = createdPermissions.filter((p) =>
    ['leaves.request', 'attendance.view', 'org.view', 'employees.view'].includes(p.name),
  );
  await prisma.rolePermission.createMany({
    data: empPerms.map((p) => ({ roleId: employeeRole.id, permissionId: p.id })),
    skipDuplicates: true,
  });

  // 6. Seed Default Super Admin User
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@sync-erp.local').toLowerCase().trim();
  const rawAdminPassword = process.env.ADMIN_PASSWORD || 'Admin@Sync2026!';
  const passwordHash = await bcrypt.hash(rawAdminPassword, 12);

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
      passwordHash: await bcrypt.hash('Employee@2026!', 12),
      isActive: true,
      roleId: employeeRole.id,
    },
  });

  await prisma.employeeProfile.upsert({
    where: { userId: sampleUser.id },
    update: {
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
      emergencyContact: {
        create: {
          name: 'Ibrahim Mansour',
          relationship: EmergencyRelationship.BROTHER,
          phone: '+20 100 999 8888',
        },
      },
      bankInfo: {
        create: {
          bankName: 'Commercial International Bank (CIB)',
          accountHolder: 'Ahmed Mansour',
          accountNumber: '100029384756',
          iban: 'EG3800020001000000100029384756',
          swift: 'CIBEEGCX',
          branch: 'Nasr City Branch',
          basicSalary: 35000.0,
        },
      },
    },
  });

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
