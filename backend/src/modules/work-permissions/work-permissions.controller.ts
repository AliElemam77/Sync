import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { WorkPermissionsService } from './work-permissions.service';
import { CreatePermissionRequestDto } from './dto/create-permission-request.dto';
import { RejectPermissionRequestDto } from './dto/reject-permission-request.dto';
import { PermissionQueryDto } from './dto/permission-query.dto';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@Controller('api/v1/work-permissions')
export class WorkPermissionsController {
  constructor(private readonly workPermissionsService: WorkPermissionsService) {}

  /**
   * Submit Work Permission Request
   */
  @Post()
  @RequirePermissions('leaves.request')
  async createPermission(
    @Body() dto: CreatePermissionRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.workPermissionsService.createPermissionRequest(user.id, dto);
  }

  /**
   * Get Work Permission Requests (Role & Department Scoped)
   */
  @Get()
  async getPermissions(
    @Query() query: PermissionQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.workPermissionsService.getPermissionRequests(query, user);
  }

  /**
   * Approve Work Permission Request (Atomically deducts monthlyPermissionHours)
   */
  @Patch(':id/approve')
  @RequirePermissions('leaves.approve')
  async approvePermission(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.workPermissionsService.approvePermissionRequest(id, user);
  }

  /**
   * Reject Work Permission Request with Reason
   */
  @Patch(':id/reject')
  @RequirePermissions('leaves.approve')
  async rejectPermission(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectPermissionRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.workPermissionsService.rejectPermissionRequest(id, dto, user);
  }
}
