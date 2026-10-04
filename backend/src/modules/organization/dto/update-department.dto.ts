import { IsBoolean, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class UpdateDepartmentDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  description?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  // null clears the department head
  @IsUUID('4')
  @IsOptional()
  headId?: string | null;

  // Commission per accepted task for this department's employees (Management only)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  commissionPerTask?: number;
}
