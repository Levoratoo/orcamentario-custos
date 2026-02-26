import { Module } from '@nestjs/common';
import { BudgetLinesService } from './budget-lines.service';
import { BudgetLinesController } from './budget-lines.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { CostCentersModule } from '../cost-centers/cost-centers.module';
import { AccountsModule } from '../accounts/accounts.module';
import { ScenariosModule } from '../scenarios/scenarios.module';

@Module({
  imports: [PrismaModule, AuditModule, CostCentersModule, AccountsModule, ScenariosModule],
  controllers: [BudgetLinesController],
  providers: [BudgetLinesService],
  exports: [BudgetLinesService],
})
export class BudgetLinesModule {}
