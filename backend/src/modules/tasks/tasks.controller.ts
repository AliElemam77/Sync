import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { QueryTasksDto } from './dto/query-tasks.dto';
import { CreateTaskCommentDto } from './dto/create-task-comment.dto';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@Controller('api/v1/tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  // ---------------------------------------------------------------------------
  // QUERY & FILTER TASKS
  // ---------------------------------------------------------------------------

  @Get()
  @RequirePermissions('tasks.view')
  async getTasks(
    @Query() query: QueryTasksDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tasksService.getTasks(query, user);
  }

  // ---------------------------------------------------------------------------
  // DEPARTMENT BACKLOG (CROSS-DEPARTMENT ROUTED UNASSIGNED TASKS)
  // ---------------------------------------------------------------------------

  @Get('department-backlog')
  @RequirePermissions('tasks.view')
  async getDepartmentBacklog(@CurrentUser() user: AuthenticatedUser) {
    return this.tasksService.getDepartmentBacklog(user);
  }

  // ---------------------------------------------------------------------------
  // GET SINGLE TASK
  // ---------------------------------------------------------------------------

  @Get(':id')
  @RequirePermissions('tasks.view')
  async getTaskById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tasksService.getTaskById(id, user);
  }

  // ---------------------------------------------------------------------------
  // CREATE TASK
  // ---------------------------------------------------------------------------

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('tasks.create')
  @Audit({ action: 'CREATE', entity: 'Task' })
  async createTask(
    @Body() dto: CreateTaskDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tasksService.createTask(dto, user);
  }

  // ---------------------------------------------------------------------------
  // UPDATE TASK DETAILS / ASSIGNEE
  // ---------------------------------------------------------------------------

  @Patch(':id')
  @RequirePermissions('tasks.update')
  @Audit({ action: 'UPDATE', entity: 'Task' })
  async updateTask(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaskDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tasksService.updateTask(id, dto, user);
  }

  // ---------------------------------------------------------------------------
  // UPDATE TASK STATUS (STRICT STATE MACHINE)
  // ---------------------------------------------------------------------------

  @Patch(':id/status')
  @RequirePermissions('tasks.update')
  @Audit({ action: 'UPDATE', entity: 'Task' })
  async updateTaskStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaskStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tasksService.updateTaskStatus(id, dto, user);
  }

  // ---------------------------------------------------------------------------
  // ADD TASK COMMENT
  // ---------------------------------------------------------------------------

  @Post(':id/comments')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('tasks.view')
  @Audit({ action: 'CREATE', entity: 'TaskComment' })
  async addComment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateTaskCommentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tasksService.addComment(id, dto, user);
  }

  // ---------------------------------------------------------------------------
  // DELETE TASK
  // ---------------------------------------------------------------------------

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('tasks.view')
  @Audit({ action: 'DELETE', entity: 'Task' })
  async deleteTask(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.tasksService.deleteTask(id, user);
  }
}
