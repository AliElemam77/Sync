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
import { OrganizationService } from './organization.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { CreatePositionDto } from './dto/create-position.dto';
import { UpdatePositionDto } from './dto/update-position.dto';
import { CreateLevelDto } from './dto/create-level.dto';
import { UpdateLevelDto } from './dto/update-level.dto';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@Controller('api/v1/organization')
export class OrganizationController {
  constructor(private readonly orgService: OrganizationService) {}

  // ---------------------------------------------------------------------------
  // FULL ORGANIZATION HIERARCHY TREE
  // ---------------------------------------------------------------------------

  @Get('tree')
  @RequirePermissions('org.view')
  async getOrganizationTree() {
    return this.orgService.getOrganizationTree();
  }

  // ---------------------------------------------------------------------------
  // DEPARTMENTS
  // ---------------------------------------------------------------------------

  @Get('departments')
  @RequirePermissions('org.view')
  async getDepartments() {
    return this.orgService.getDepartments();
  }

  @Get('departments/:id')
  @RequirePermissions('org.view')
  async getDepartmentById(@Param('id', ParseUUIDPipe) id: string) {
    return this.orgService.getDepartmentById(id);
  }

  @Post('departments')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('org.manage')
  @Audit({ action: 'CREATE', entity: 'Department' })
  async createDepartment(@Body() dto: CreateDepartmentDto) {
    return this.orgService.createDepartment(dto);
  }

  @Patch('departments/:id')
  @RequirePermissions('org.manage')
  @Audit({ action: 'UPDATE', entity: 'Department' })
  async updateDepartment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDepartmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.orgService.updateDepartment(id, dto, user);
  }

  @Delete('departments/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('org.manage')
  @Audit({ action: 'DELETE', entity: 'Department' })
  async deleteDepartment(@Param('id', ParseUUIDPipe) id: string) {
    await this.orgService.deleteDepartment(id);
  }

  // ---------------------------------------------------------------------------
  // POSITIONS
  // ---------------------------------------------------------------------------

  @Get('positions')
  @RequirePermissions('org.view')
  async getPositions(@Query('departmentId') departmentId?: string) {
    return this.orgService.getPositions(departmentId);
  }

  @Get('positions/:id')
  @RequirePermissions('org.view')
  async getPositionById(@Param('id', ParseUUIDPipe) id: string) {
    return this.orgService.getPositionById(id);
  }

  @Post('positions')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('org.manage')
  @Audit({ action: 'CREATE', entity: 'Position' })
  async createPosition(@Body() dto: CreatePositionDto) {
    return this.orgService.createPosition(dto);
  }

  @Patch('positions/:id')
  @RequirePermissions('org.manage')
  @Audit({ action: 'UPDATE', entity: 'Position' })
  async updatePosition(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePositionDto,
  ) {
    return this.orgService.updatePosition(id, dto);
  }

  @Delete('positions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('org.manage')
  @Audit({ action: 'DELETE', entity: 'Position' })
  async deletePosition(@Param('id', ParseUUIDPipe) id: string) {
    await this.orgService.deletePosition(id);
  }

  // ---------------------------------------------------------------------------
  // LEVELS
  // ---------------------------------------------------------------------------

  @Get('levels')
  @RequirePermissions('org.view')
  async getLevels(@Query('positionId') positionId?: string) {
    return this.orgService.getLevels(positionId);
  }

  @Post('levels')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('org.manage')
  @Audit({ action: 'CREATE', entity: 'Level' })
  async createLevel(@Body() dto: CreateLevelDto) {
    return this.orgService.createLevel(dto);
  }

  @Patch('levels/:id')
  @RequirePermissions('org.manage')
  @Audit({ action: 'UPDATE', entity: 'Level' })
  async updateLevel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLevelDto,
  ) {
    return this.orgService.updateLevel(id, dto);
  }

  @Delete('levels/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('org.manage')
  @Audit({ action: 'DELETE', entity: 'Level' })
  async deleteLevel(@Param('id', ParseUUIDPipe) id: string) {
    await this.orgService.deleteLevel(id);
  }
}
