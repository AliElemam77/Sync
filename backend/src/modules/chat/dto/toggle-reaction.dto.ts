import { IsString, IsNotEmpty } from 'class-validator';

export class ToggleReactionDto {
  @IsString()
  @IsNotEmpty({ message: 'الرمز التفاعلي مطلوب' })
  emoji: string;
}
