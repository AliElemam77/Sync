import { Module } from '@nestjs/common';
import { WorkPermissionsController } from './work-permissions.controller';
import { WorkPermissionsService } from './work-permissions.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [PrismaModule, EventsModule],
  controllers: [WorkPermissionsController],
  providers: [WorkPermissionsService],
  exports: [WorkPermissionsService],
})
export class WorkPermissionsModule {}
