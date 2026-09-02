import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
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

  @IsString()
  @IsOptional()
  departmentId?: string;

  @IsInt()
  @Min(1)
  @Max(200)
  @IsOptional()
  @Type(() => Number)
  limit?: number = 50;
}
