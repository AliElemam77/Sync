import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AccountingService } from './accounting.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { ReverseTransactionDto } from './dto/reverse-transaction.dto';
import { QueryTransactionsDto } from './dto/query-transactions.dto';
import { FinancialSummaryQueryDto } from './dto/financial-summary-query.dto';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@Controller('api/v1/accounting')
export class AccountingController {
  constructor(private readonly accountingService: AccountingService) {}

  // ---------------------------------------------------------------------------
  // 1. CREATE FINANCIAL TRANSACTION
  // ---------------------------------------------------------------------------

  @Post('transactions')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('accounting.manage')
  @Audit({ action: 'CREATE', entity: 'FinancialTransaction' })
  async createTransaction(
    @Body() dto: CreateTransactionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.accountingService.createTransaction(dto, user);
  }

  // ---------------------------------------------------------------------------
  // 2. REVERSE TRANSACTION (قيد عكسي)
  // ---------------------------------------------------------------------------

  @Post('transactions/:id/reverse')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('accounting.manage')
  @Audit({ action: 'UPDATE', entity: 'FinancialTransactionReversal' })
  async reverseTransaction(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReverseTransactionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.accountingService.reverseTransaction(id, dto, user);
  }

  // ---------------------------------------------------------------------------
  // 3. GET TRANSACTIONS (LEDGER TABLE)
  // ---------------------------------------------------------------------------

  @Get('transactions')
  @RequirePermissions('accounting.view')
  async getTransactions(@Query() query: QueryTransactionsDto) {
    return this.accountingService.getTransactions(query);
  }

  // ---------------------------------------------------------------------------
  // 4. GET FINANCIAL SUMMARY & ANALYTICS
  // ---------------------------------------------------------------------------

  @Get('summary')
  @RequirePermissions('accounting.view')
  async getFinancialSummary(@Query() query: FinancialSummaryQueryDto) {
    return this.accountingService.getFinancialSummary(query);
  }

  // ---------------------------------------------------------------------------
  // 5. GET TRANSACTION BY ID
  // ---------------------------------------------------------------------------

  @Get('transactions/:id')
  @RequirePermissions('accounting.view')
  async getTransactionById(@Param('id', ParseUUIDPipe) id: string) {
    return this.accountingService.getTransactionById(id);
  }
}
