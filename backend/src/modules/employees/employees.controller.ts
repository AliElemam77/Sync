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
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { QueryEmployeesDto } from './dto/query-employees.dto';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@Controller('api/v1/employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get('next-code')
  @RequirePermissions('employees.create')
  async getNextEmployeeCode() {
    const nextCode = await this.employeesService.getNextEmployeeCode();
    return { nextCode };
  }

  @Get()
  @RequirePermissions('employees.view')
  async getEmployees(
    @Query() query: QueryEmployeesDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.employeesService.getEmployees(query, user);
  }

  @Get(':id')
  @RequirePermissions('employees.view')
  async getEmployeeById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.employeesService.getEmployeeById(id, user);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('employees.create')
  @Audit({ action: 'CREATE', entity: 'EmployeeProfile' })
  async createEmployee(
    @Body() dto: CreateEmployeeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.employeesService.createEmployee(dto, user);
  }

  @Patch(':id')
  @RequirePermissions('employees.update')
  @Audit({ action: 'UPDATE', entity: 'EmployeeProfile' })
  async updateEmployee(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.employeesService.updateEmployee(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('employees.delete')
  @Audit({ action: 'DELETE', entity: 'EmployeeProfile' })
  async deleteEmployee(@Param('id', ParseUUIDPipe) id: string) {
    await this.employeesService.deleteEmployee(id);
  }
}
