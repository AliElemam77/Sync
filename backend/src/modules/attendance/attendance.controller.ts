import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Patch,
  Put,
  Query,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { AttendanceQueryDto } from './dto/attendance-query.dto';
import { CheckInDto } from './dto/check-in.dto';
import { CreatePublicHolidayDto } from './dto/create-public-holiday.dto';
import { HolidayQueryDto } from './dto/holiday-query.dto';
import { RecordAttendanceDto } from './dto/record-attendance.dto';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Audit } from '../../common/decorators/audit.decorator';

@Controller('api/v1/attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  /**
   * Get Today's Live Shift & Attendance Status
   */
  @Get('today')
  async getTodayStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.attendanceService.getTodayStatus(user);
  }

  /**
   * Check In for Today
   */
  @Post('check-in')
  async checkIn(@CurrentUser() user: AuthenticatedUser, @Body() dto: CheckInDto) {
    return this.attendanceService.checkIn(user.id, dto.confirmDayOff);
  }

  /**
   * Check Out for Today (Calculates Delay or Overtime)
   */
  @Patch('check-out')
  async checkOut(@CurrentUser() user: AuthenticatedUser) {
    return this.attendanceService.checkOut(user.id);
  }

  /**
   * Get Attendance Records with Dynamic Role/Department Scoping
   */
  @Get('records')
  @RequirePermissions('attendance.view')
  async getRecords(
    @Query() query: AttendanceQueryDto,
    @CurrentUser() user: AuthenticatedUser,
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

  /**
   * HR correction of one employee's day (e.g. a forgotten check-in)
   */
  @Put('records')
  @RequirePermissions('attendance.manage')
  @Audit({ action: 'UPDATE', entity: 'AttendanceRecord' })
  async recordAttendance(@Body() dto: RecordAttendanceDto) {
    return this.attendanceService.recordAttendance(dto);
  }

  /**
   * Public holidays of a year (defaults to the current year)
   */
  @Get('holidays')
  @RequirePermissions('attendance.view')
  async getPublicHolidays(@Query() query: HolidayQueryDto) {
    return this.attendanceService.getPublicHolidays(query.year);
  }

  @Post('holidays')
  @RequirePermissions('attendance.manage')
  @Audit({ action: 'CREATE', entity: 'PublicHoliday' })
  async createPublicHoliday(@Body() dto: CreatePublicHolidayDto) {
    return this.attendanceService.createPublicHoliday(dto);
  }

  @Delete('holidays/:id')
  @RequirePermissions('attendance.manage')
  @Audit({ action: 'DELETE', entity: 'PublicHoliday' })
  async deletePublicHoliday(@Param('id', ParseUUIDPipe) id: string) {
    return this.attendanceService.deletePublicHoliday(id);
  }
}
