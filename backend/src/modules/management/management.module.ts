import { Module } from '@nestjs/common';
import { ManagementController } from './management.controller';
import { ManagementService } from './management.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { LeavesModule } from '../leaves/leaves.module';
import { WorkPermissionsModule } from '../work-permissions/work-permissions.module';

@Module({
  imports: [PrismaModule, LeavesModule, WorkPermissionsModule],
  controllers: [ManagementController],
  providers: [ManagementService],
  exports: [ManagementService],
})
export class ManagementModule {}
