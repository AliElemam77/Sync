import {
  IsBoolean,
  IsEmail,
  IsEnum,
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
} from '@prisma/client';
import { EmergencyContactDto, BankInfoDto } from './create-employee.dto';

export class UpdateEmployeeDto {
  @IsString()
  @IsOptional()
  fullName?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @MinLength(8)
  @IsOptional()
  password?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsUUID('4')
  @IsOptional()
  roleId?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  dob?: string;

  @IsEnum(Gender)
  @IsOptional()
  gender?: Gender;

  @IsEnum(ShiftType)
  @IsOptional()
  shiftType?: ShiftType;

  @IsString()
  @IsOptional()
  avatarUrl?: string;

  @IsString()
  @IsOptional()
  company?: string;

  @IsString()
  @IsOptional()
  branch?: string;

  @IsUUID('4')
  @IsOptional()
  departmentId?: string;

  @IsUUID('4')
  @IsOptional()
  positionId?: string;

  @IsUUID('4')
  @IsOptional()
  levelId?: string;

  @IsString()
  @IsOptional()
  joiningDate?: string;

  @IsEnum(EmploymentType)
  @IsOptional()
  employmentType?: EmploymentType;

  @IsEnum(EmployeeStatus)
  @IsOptional()
  status?: EmployeeStatus;

  @IsNumber()
  @Min(0)
  @IsOptional()
  annualLeaveDays?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  monthlyPermissionHours?: number;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  altPhone?: string;

  @ValidateNested()
  @Type(() => EmergencyContactDto)
  @IsOptional()
  emergencyContact?: EmergencyContactDto;

  @ValidateNested()
  @Type(() => BankInfoDto)
  @IsOptional()
  bankInfo?: BankInfoDto;

  // Multi-Department Management (For Heads)
  @IsUUID('4', { each: true, message: 'كل قسم يجب أن يكون UUID صحيح' })
  @IsOptional()
  managedDepartmentIds?: string[];
}
