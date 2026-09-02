import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class EditMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  content: string;
}
