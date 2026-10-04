import {
  IsArray,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { TaskStatus, TaskPriority, TaskAssignmentType } from '@prisma/client';

export const TASK_WEIGHTS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

export class UpdateTaskDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(TaskStatus)
  @IsOptional()
  status?: TaskStatus;

  @IsEnum(TaskPriority)
  @IsOptional()
  priority?: TaskPriority;

  @IsEnum(TaskAssignmentType)
  @IsOptional()
  assignmentType?: TaskAssignmentType;

  @IsString()
  @IsOptional()
  dueDate?: string;

  @IsUUID('4')
  @IsOptional()
  assigneeId?: string;

  @IsUUID('4')
  @IsOptional()
  targetDepartmentId?: string;

  @IsNumber()
  @IsOptional()
  order?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  attachmentUrls?: string[];

  // Effort weight (commission multiplier): 0.5 to 5 in steps of 0.5; 1 is a normal task
  @IsIn(TASK_WEIGHTS, { message: 'weight must be between 0.5 and 5 in steps of 0.5' })
  @IsOptional()
  weight?: number;
}
