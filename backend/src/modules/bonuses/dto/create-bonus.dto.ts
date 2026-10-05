import { BonusKind } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class CreateBonusDto {
  @IsUUID()
  employeeId: string;

  // PAY (default): days of pay on the month's payslip. LEAVE: extra leave days (Management only)
  @IsOptional()
  @IsEnum(BonusKind)
  kind?: BonusKind;

  // In half days: 0.5, 1, 1.5, 2...
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0.5)
  @Max(10)
  days: number;

  @IsString()
  @IsNotEmpty({ message: 'Reason is required' })
  @MaxLength(200)
  reason: string;
}
