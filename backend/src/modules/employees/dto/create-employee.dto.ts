import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  Gender,
  ShiftType,
  EmploymentType,
  EmployeeStatus,
  EmergencyRelationship,
} from '@prisma/client';

export class EmergencyContactDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEnum(EmergencyRelationship)
  @IsOptional()
  relationship?: EmergencyRelationship;

  @IsString()
  @IsNotEmpty()
  phone!: string;
}

export class BankInfoDto {
  @IsString()
  @IsOptional()
  bankName?: string;

  @IsString()
  @IsOptional()
  accountHolder?: string;

  @IsString()
  @IsOptional()
  accountNumber?: string;

  @IsString()
  @IsOptional()
  iban?: string;

  @IsString()
  @IsOptional()
  swift?: string;

  @IsString()
  @IsOptional()
  branch?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  basicSalary?: number;
}

export class CreateEmployeeDto {
  // 1. Basic Info & Auth Credentials
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @IsEmail({}, { message: 'Invalid email address' })
  @IsNotEmpty()
  email!: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @IsNotEmpty()
  password!: string;

  @IsString()
  @IsNotEmpty()
  phone!: string;

  @IsString()
  @IsOptional()
  dob?: string; // ISO string date

  @IsEnum(Gender)
  @IsOptional()
  gender?: Gender;

  @IsEnum(ShiftType)
  @IsOptional()
  shiftType?: ShiftType;

  @IsString()
  @IsOptional()
  avatarUrl?: string;

  // 2. Employment Details
  @IsString()
  @IsOptional()
  company?: string;

  @IsString()
  @IsOptional()
  branch?: string;

  @IsUUID('4', { message: 'departmentId must be a valid UUID' })
  @IsNotEmpty()
  departmentId!: string;

  @IsUUID('4', { message: 'positionId must be a valid UUID' })
  @IsNotEmpty()
  positionId!: string;

  @IsUUID('4', { message: 'levelId must be a valid UUID' })
  @IsOptional()
  levelId?: string;

  @IsString()
  @IsOptional()
  joiningDate?: string; // ISO string date

  @IsEnum(EmploymentType)
  @IsOptional()
  employmentType?: EmploymentType;

  @IsEnum(EmployeeStatus)
  @IsOptional()
  status?: EmployeeStatus;

  // 3. Contact Info
  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  altPhone?: string;

  // 4. Emergency Contact
  @ValidateNested()
  @Type(() => EmergencyContactDto)
  @IsOptional()
  emergencyContact?: EmergencyContactDto;

  // 5. Bank Info
  @ValidateNested()
  @Type(() => BankInfoDto)
  @IsOptional()
  bankInfo?: BankInfoDto;
}
