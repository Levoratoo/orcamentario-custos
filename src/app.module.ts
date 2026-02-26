import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'crypto';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CostCentersModule } from './cost-centers/cost-centers.module';
import { AccountsModule } from './accounts/accounts.module';
import { ScenariosModule } from './scenarios/scenarios.module';
import { BudgetLinesModule } from './budget-lines/budget-lines.module';
import { AuditModule } from './audit/audit.module';
import { ImportsModule } from './imports/imports.module';
import { AccountPlansModule } from './account-plans/account-plans.module';
import { BudgetsModule } from './budgets/budgets.module';
import { DreModule } from './dre/dre.module';
import { BudgetItemsModule } from './budget-items/budget-items.module';
import { SponsorsModule } from './sponsors/sponsors.module';
import { ClosingMonthModule } from './closing-month/closing-month.module';
import { PlanningModule } from './planning/planning.module';
import { BscModule } from './modules/bsc/bsc.module';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        genReqId: (req, res) => {
          const existing = req.headers['x-request-id'];
          const id = Array.isArray(existing) ? existing[0] : existing;
          const requestId = id || randomUUID();
          res.setHeader('x-request-id', requestId);
          return requestId;
        },
      },
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    CostCentersModule,
    AccountsModule,
    ScenariosModule,
    BudgetLinesModule,
    BudgetsModule,
    DreModule,
    BudgetItemsModule,
    SponsorsModule,
    ClosingMonthModule,
    PlanningModule,
    BscModule,
    AuditModule,
    ImportsModule,
    AccountPlansModule,
  ],
})
export class AppModule {}
