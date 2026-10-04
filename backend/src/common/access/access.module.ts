import { Global, Module } from '@nestjs/common';
import { AccessScopeService } from './access-scope.service';

@Global()
@Module({
  providers: [AccessScopeService],
  exports: [AccessScopeService],
})
export class AccessModule {}
