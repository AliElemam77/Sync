import { IsOptional, IsInt, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { PayrollCycleStatus } from '@prisma/client';

export class QueryPayrollCyclesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  year?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  month?: number;

  @IsOptional()
  @IsEnum(PayrollCycleStatus)
  status?: PayrollCycleStatus;
}
