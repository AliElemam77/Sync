import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, Matches } from 'class-validator';

export class CreateDepartmentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  @Matches(/^[A-Z0-9_-]+$/, {
    message: 'Department code must be uppercase alphanumeric (e.g., ENG, HR, FIN_01)',
  })
  code!: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  description?: string;

  @IsUUID('4')
  @IsOptional()
  headId?: string;
}
