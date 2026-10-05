import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { BonusesService } from './bonuses.service';
import { CreateBonusDto } from './dto/create-bonus.dto';
import { BonusQueryDto } from './dto/bonus-query.dto';
import { Audit } from '../../common/decorators/audit.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

// Who may grant, see or cancel a bonus is decided per employee in BonusesService
@Controller('api/v1/bonuses')
export class BonusesController {
  constructor(private readonly bonusesService: BonusesService) {}

  @Get()
  async list(@Query() query: BonusQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.bonusesService.list(query, user);
  }

  @Post()
  @Audit({ action: 'CREATE', entity: 'Bonus' })
  async grant(@Body() dto: CreateBonusDto, @CurrentUser() user: AuthenticatedUser) {
    return this.bonusesService.grant(dto, user);
  }

  @Patch(':id/cancel')
  @Audit({ action: 'UPDATE', entity: 'BonusCancellation' })
  async cancel(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.bonusesService.cancel(id, user);
  }
}
