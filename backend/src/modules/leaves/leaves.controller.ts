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
import { LeavesService } from './leaves.service';
import { CreateLeaveDto } from './dto/create-leave.dto';
import { RejectLeaveDto } from './dto/reject-leave.dto';
import { LeaveQueryDto } from './dto/leave-query.dto';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@Controller('api/v1/leaves')
export class LeavesController {
  constructor(private readonly leavesService: LeavesService) {}

  /**
   * Submit Leave Request
   */
  @Post()
  @RequirePermissions('leaves.request')
  async createLeave(
    @Body() dto: CreateLeaveDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leavesService.createLeaveRequest(user.id, dto);
  }

  /**
   * Get Leave Requests (Role & Department Scoped)
   */
  @Get()
  async getLeaves(
    @Query() query: LeaveQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leavesService.getLeaveRequests(query, user);
  }

  /**
   * Approve Leave Request (Atomically deducts annualLeaveDays)
   */
  @Patch(':id/approve')
  @RequirePermissions('leaves.approve')
  async approveLeave(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leavesService.approveLeaveRequest(id, user);
  }

  /**
   * Reject Leave Request with Reason
   */
  @Patch(':id/reject')
  @RequirePermissions('leaves.approve')
  async rejectLeave(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectLeaveDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leavesService.rejectLeaveRequest(id, dto, user);
  }
}
