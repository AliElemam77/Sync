import { IsBoolean, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class UpdatePayrollSettingsDto {
  @IsOptional()
  @IsBoolean()
  overtimeEnabled?: boolean;

  // Regular hours paid for each overtime hour
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(10)
  overtimeMultiplier?: number;
}
