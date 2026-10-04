import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum PendingRequestType {
  ALL = 'ALL',
  LEAVE = 'LEAVE',
  PERMISSION = 'PERMISSION',
  TASK_REVIEW = 'TASK_REVIEW',
}

export class QueryPendingRequestsDto {
  @IsEnum(PendingRequestType)
  @IsOptional()
  type?: PendingRequestType = PendingRequestType.ALL;

  @IsUUID('4')
  @IsOptional()
  departmentId?: string;

  @IsInt()
  @Min(1)
  @Max(200)
  @IsOptional()
  @Type(() => Number)
  limit?: number = 50;
}
