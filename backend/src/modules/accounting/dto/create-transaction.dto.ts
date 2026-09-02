import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TransactionType, TransactionCategory, PaymentMethod } from '@prisma/client';

export class CreateTransactionDto {
  @IsNumber({}, { message: 'المبلغ يجب أن يكون قيمة رقمية صحيحة' })
  @Min(0.01, { message: 'المبلغ يجب أن يكون أكبر من 0' })
  @IsNotEmpty({ message: 'المبلغ المالي مطلوب' })
  @Type(() => Number)
  amount: number;

  @IsEnum(TransactionType, { message: 'نوع القيد غير صالح (إيراد أو مصروف)' })
  @IsNotEmpty({ message: 'نوع المعاملة المالية مطلوب' })
  type: TransactionType;

  @IsEnum(TransactionCategory, { message: 'تصنيف المعاملة غير صالح' })
  @IsNotEmpty({ message: 'تصنيف القيد المالي مطلوب' })
  category: TransactionCategory;

  @IsEnum(PaymentMethod, { message: 'طريقة الدفع غير صالحة' })
  @IsOptional()
  paymentMethod?: PaymentMethod = PaymentMethod.BANK_TRANSFER;

  @IsString()
  @IsNotEmpty({ message: 'البيان وشرح المعاملة مطلوب' })
  @MaxLength(255, { message: 'البيان لا يتجاوز 255 حرفاً' })
  description: string;

  @IsString()
  @IsOptional()
  transactionDate?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  referenceId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  referenceType?: string;

  @IsString()
  @IsOptional()
  attachmentUrl?: string;
}
