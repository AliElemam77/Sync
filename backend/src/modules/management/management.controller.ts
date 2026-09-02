import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ManagementService } from './management.service';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto';
import { QueryPendingRequestsDto } from './dto/query-pending-requests.dto';
import { ManagementOverrideDto } from './dto/management-override.dto';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@Controller('api/v1/management')
export class ManagementController {
  constructor(private readonly managementService: ManagementService) {}

  // ---------------------------------------------------------------------------
  // 1. GET GLOBAL AUDIT LOGS (TIMELINE FEED)
  // ---------------------------------------------------------------------------

  @Get('audit-logs')
  @RequirePermissions('audit.view')
  async getAuditLogs(@Query() query: QueryAuditLogsDto) {
    return this.managementService.getAuditLogs(query);
  }

  // ---------------------------------------------------------------------------
  // 2. GET UNIFIED PENDING REQUESTS (ACTIONABLE INBOX)
  // ---------------------------------------------------------------------------

  @Get('pending-requests')
  @RequirePermissions('audit.view')
  async getPendingRequests(@Query() query: QueryPendingRequestsDto) {
    return this.managementService.getPendingRequests(query);
  }

  // ---------------------------------------------------------------------------
  // 3. GET COMMAND CENTER OVERVIEW STATS
  // ---------------------------------------------------------------------------

  @Get('stats')
  @RequirePermissions('audit.view')
  async getManagementStats() {
    return this.managementService.getManagementStats();
  }

  // ---------------------------------------------------------------------------
  // 4. MANAGEMENT OVERRIDE ACTION
  // ---------------------------------------------------------------------------

  @Post('override-action')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('audit.view')
  @Audit({ action: 'UPDATE', entity: 'ManagementOverride' })
  async overrideAction(
    @Body() dto: ManagementOverrideDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.managementService.overrideAction(dto, user);
  }
}
