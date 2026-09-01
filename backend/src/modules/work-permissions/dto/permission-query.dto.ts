import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { RequestStatus } from '@prisma/client';

export class PermissionQueryDto {
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsEnum(RequestStatus)
  status?: RequestStatus;
}
