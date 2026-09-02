import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AssetType } from '@prisma/client';

export class CreateAssetDto {
  @IsString()
  @IsNotEmpty({ message: 'اسم الأصل أو الجهاز مطلوب' })
  @MaxLength(150, { message: 'اسم الأصل لا يمكن أن يتجاوز 150 حرفاً' })
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'الرقم التسلسلي أو الـ SKU مطلوب' })
  @MaxLength(100, { message: 'الرقم التسلسلي لا يمكن أن يتجاوز 100 حرف' })
  serialNumber: string;

  @IsEnum(AssetType, { message: 'نوع الأصل غير صالح' })
  @IsNotEmpty({ message: 'نوع الأصل مطلوب' })
  type: AssetType;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  model?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  manufacturer?: string;

  @IsString()
  @IsOptional()
  purchaseDate?: string;

  @IsNumber({}, { message: 'تكلفة الشراء يجب أن تكون رقماً' })
  @Min(0, { message: 'تكلفة الشراء لا يمكن أن تكون سالبة' })
  @IsOptional()
  @Type(() => Number)
  purchaseCost?: number;

  @IsString()
  @IsOptional()
  warrantyExpiry?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsUUID('4', { message: 'معرف الموظف غير صالح' })
  @IsOptional()
  assigneeId?: string;

  @IsString()
  @IsOptional()
  conditionNotes?: string;
}
