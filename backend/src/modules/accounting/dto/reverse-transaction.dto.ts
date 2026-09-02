import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ReverseTransactionDto {
  @IsString({ message: 'سبب القيد العكسي يجب أن يكون نصاً' })
  @IsNotEmpty({ message: 'يرجى توضيح سبب إلغاء القيد وعكس المعاملة' })
  @MaxLength(500, { message: 'سبب الإلغاء لا يتجاوز 500 حرف' })
  reason: string;
}
