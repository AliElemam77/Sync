import { IsIn, IsNotEmpty, IsOptional, IsString, IsDateString, IsInt, Min } from 'class-validator';
import { LeaveType } from '@prisma/client';
import { REQUESTABLE_LEAVE_TYPES } from '../leave-policy';

export class CreateLeaveDto {
  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @IsDateString()
  @IsNotEmpty()
  endDate: string;

  // Ignored: the server counts working days between the dates. Accepted so existing clients keep working.
  @IsOptional()
  @IsInt()
  @Min(1)
  totalDaysRequested?: number;

  @IsIn(REQUESTABLE_LEAVE_TYPES, { message: `type must be one of: ${REQUESTABLE_LEAVE_TYPES.join(', ')}` })
  type: LeaveType;

  @IsOptional()
  @IsString()
  reason?: string;
}
