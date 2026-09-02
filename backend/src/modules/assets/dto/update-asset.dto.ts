import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AssetType, AssetStatus } from '@prisma/client';

export class UpdateAssetDto {
  @IsString()
  @IsOptional()
  @MaxLength(150, { message: 'اسم الأصل لا يمكن أن يتجاوز 150 حرفاً' })
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100, { message: 'الرقم التسلسلي لا يمكن أن يتجاوز 100 حرف' })
  serialNumber?: string;

  @IsEnum(AssetType, { message: 'نوع الأصل غير صالح' })
  @IsOptional()
  type?: AssetType;

  @IsEnum(AssetStatus, { message: 'حالة الأصل غير صالحة' })
  @IsOptional()
  status?: AssetStatus;

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
}
