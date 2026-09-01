import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { RequestStatus, LeaveType } from '@prisma/client';

export class LeaveQueryDto {
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsEnum(RequestStatus)
  status?: RequestStatus;

  @IsOptional()
  @IsEnum(LeaveType)
  type?: LeaveType;
}
