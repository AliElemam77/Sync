import { IsEnum, IsNotEmpty, IsOptional, IsString, IsDateString, IsInt, Min } from 'class-validator';
import { LeaveType } from '@prisma/client';

export class CreateLeaveDto {
  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @IsDateString()
  @IsNotEmpty()
  endDate: string;

  @IsInt()
  @Min(1)
  totalDaysRequested: number;

  @IsEnum(LeaveType)
  type: LeaveType;

  @IsOptional()
  @IsString()
  reason?: string;
}
