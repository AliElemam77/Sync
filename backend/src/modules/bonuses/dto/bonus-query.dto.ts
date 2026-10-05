import { IsOptional, Matches } from 'class-validator';

export class BonusQueryDto {
  // Payroll month as YYYY-MM; defaults to the current month
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'month must be YYYY-MM' })
  month?: string;
}
