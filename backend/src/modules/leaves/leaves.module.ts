import { Module } from '@nestjs/common';
import { LeavesController } from './leaves.controller';
import { LeavesService } from './leaves.service';
import { LeaveAccrualService } from './leave-accrual.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [PrismaModule, EventsModule],
  controllers: [LeavesController],
  providers: [LeavesService, LeaveAccrualService],
  exports: [LeavesService],
})
export class LeavesModule {}
