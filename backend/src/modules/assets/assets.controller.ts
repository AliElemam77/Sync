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
import { AssetsService } from './assets.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { QueryAssetsDto } from './dto/query-assets.dto';
import { AssignAssetDto } from './dto/assign-asset.dto';
import { ReturnAssetDto } from './dto/return-asset.dto';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@Controller('api/v1/assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  // ---------------------------------------------------------------------------
  // CREATE ASSET
  // ---------------------------------------------------------------------------

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('it.manage_assets')
  @Audit({ action: 'CREATE', entity: 'Asset' })
  async createAsset(
    @Body() dto: CreateAssetDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.assetsService.createAsset(dto, user);
  }

  // ---------------------------------------------------------------------------
  // QUERY ASSETS
  // ---------------------------------------------------------------------------

  @Get()
  @RequirePermissions('assets.view')
  async getAssets(@Query() query: QueryAssetsDto) {
    return this.assetsService.getAssets(query);
  }

  // ---------------------------------------------------------------------------
  // ASSET DASHBOARD STATISTICS
  // ---------------------------------------------------------------------------

  @Get('stats')
  @RequirePermissions('assets.view')
  async getAssetStats() {
    return this.assetsService.getAssetStats();
  }

  // ---------------------------------------------------------------------------
  // GET EMPLOYEE ASSIGNED ASSETS (عهدة موظف)
  // ---------------------------------------------------------------------------

  @Get('employee/:employeeId')
  @RequirePermissions('assets.view')
  async getEmployeeAssets(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
  ) {
    return this.assetsService.getEmployeeAssets(employeeId);
  }

  // ---------------------------------------------------------------------------
  // GET SINGLE ASSET BY ID
  // ---------------------------------------------------------------------------

  @Get(':id')
  @RequirePermissions('assets.view')
  async getAssetById(@Param('id', ParseUUIDPipe) id: string) {
    return this.assetsService.getAssetById(id);
  }

  // ---------------------------------------------------------------------------
  // UPDATE ASSET
  // ---------------------------------------------------------------------------

  @Patch(':id')
  @RequirePermissions('it.manage_assets')
  @Audit({ action: 'UPDATE', entity: 'Asset' })
  async updateAsset(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAssetDto,
  ) {
    return this.assetsService.updateAsset(id, dto);
  }

  // ---------------------------------------------------------------------------
  // DELETE ASSET
  // ---------------------------------------------------------------------------

  @Delete(':id')
  @RequirePermissions('it.manage_assets')
  @Audit({ action: 'DELETE', entity: 'Asset' })
  async deleteAsset(@Param('id', ParseUUIDPipe) id: string) {
    return this.assetsService.deleteAsset(id);
  }

  // ---------------------------------------------------------------------------
  // ASSIGN ASSET (تسليم عهدة)
  // ---------------------------------------------------------------------------

  @Post(':id/assign')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('it.manage_assets')
  @Audit({ action: 'UPDATE', entity: 'AssetAssignment' })
  async assignAsset(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignAssetDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.assetsService.assignAsset(id, dto, user);
  }

  // ---------------------------------------------------------------------------
  // RETURN ASSET (استرجاع عهدة)
  // ---------------------------------------------------------------------------

  @Post(':id/return')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('it.manage_assets')
  @Audit({ action: 'UPDATE', entity: 'AssetAssignment' })
  async returnAsset(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReturnAssetDto,
  ) {
    return this.assetsService.returnAsset(id, dto);
  }
}
