import {
  Controller,
  Get,
  Post,
  Patch,
  Query,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { AttendanceQueryDto } from './dto/attendance-query.dto';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@Controller('api/v1/attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  /**
   * Get Today's Live Shift & Attendance Status
   */
  @Get('today')
  async getTodayStatus(@CurrentUser() user: any) {
    return this.attendanceService.getTodayStatus(user.id);
  }

  /**
   * Check In for Today
   */
  @Post('check-in')
  async checkIn(@CurrentUser() user: any) {
    return this.attendanceService.checkIn(user.id);
  }

  /**
   * Check Out for Today (Calculates Delay or Overtime)
   */
  @Patch('check-out')
  async checkOut(@CurrentUser() user: any) {
    return this.attendanceService.checkOut(user.id);
  }

  /**
   * Get Attendance Records with Dynamic Role/Department Scoping
   */
  @Get('records')
  @RequirePermissions('attendance.view')
  async getRecords(
    @Query() query: AttendanceQueryDto,
    @CurrentUser() user: any,
  ) {
    return this.attendanceService.getRecords(query, user);
  }

  /**
   * Get Monthly Attendance Summary Report
   */
  @Get('summary/:employeeId')
  @RequirePermissions('attendance.view')
  async getMonthlySummary(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Query('year', ParseIntPipe) year: number,
    @Query('month', ParseIntPipe) month: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attendanceService.getMonthlySummary(employeeId, year, month, user);
  }
}
