import { IsEnum, IsOptional, IsString } from 'class-validator';
import { AssetStatus } from '@prisma/client';

export class ReturnAssetDto {
  @IsString()
  @IsOptional()
  conditionNotes?: string;

  @IsEnum(AssetStatus, { message: 'حالة الأصل المسترجع غير صالحة' })
  @IsOptional()
  status?: AssetStatus = AssetStatus.AVAILABLE;
}
