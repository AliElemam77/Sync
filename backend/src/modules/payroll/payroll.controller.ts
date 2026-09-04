import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { GeneratePayrollDto } from './dto/generate-payroll.dto';
import { QueryPayrollCyclesDto } from './dto/query-payroll-cycles.dto';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import {
  CurrentUser,
  AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';

@Controller('api/v1/payroll')
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  // ---------------------------------------------------------------------------
  // 1. GENERATE PAYROLL FOR A SPECIFIC MONTH / YEAR
  // ---------------------------------------------------------------------------

  @Post('generate')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('payroll.manage')
  @Audit({ action: 'CREATE', entity: 'PayrollCycle' })
  async generatePayroll(
    @Body() dto: GeneratePayrollDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.payrollService.generatePayroll(dto, user);
  }

  // ---------------------------------------------------------------------------
  // 2. GET ALL PAYROLL CYCLES
  // ---------------------------------------------------------------------------

  @Get('cycles')
  @RequirePermissions('payroll.view')
  async listCycles(@Query() query: QueryPayrollCyclesDto) {
    return this.payrollService.listCycles(query);
  }

  // ---------------------------------------------------------------------------
  // 3. EMPLOYEE SELF-SERVICE: MY PAYSLIPS
  // ---------------------------------------------------------------------------

  @Get('my-payslips')
  @RequirePermissions('payroll.self')
  async getMyPayslips(@CurrentUser() user: AuthenticatedUser) {
    return this.payrollService.getMyPayslips(user.id);
  }

  // ---------------------------------------------------------------------------
  // 4. GET SINGLE PAYSLIP DETAILS
  // ---------------------------------------------------------------------------

  @Get('payslips/:id')
  async getPayslipById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.payrollService.getPayslipById(id, user);
  }

  // ---------------------------------------------------------------------------
  // 5. GET SINGLE PAYROLL CYCLE WITH ALL EMPLOYEE PAYSLIPS
  // ---------------------------------------------------------------------------

  @Get('cycles/:id')
  @RequirePermissions('payroll.view')
  async getCycleById(@Param('id', ParseUUIDPipe) id: string) {
    return this.payrollService.getCycleById(id);
  }

  // ---------------------------------------------------------------------------
  // 6. APPROVE & LOCK PAYROLL CYCLE
  // ---------------------------------------------------------------------------

  @Patch('cycles/:id/approve')
  @RequirePermissions('payroll.manage')
  @Audit({ action: 'UPDATE', entity: 'PayrollCycle' })
  async approveCycle(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.payrollService.approveCycle(id, user);
  }
}
