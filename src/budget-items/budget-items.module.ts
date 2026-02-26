import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BudgetItemsController } from './budget-items.controller';
import { BudgetItemsService } from './budget-items.service';

@Module({
  imports: [PrismaModule],
  controllers: [BudgetItemsController],
  providers: [BudgetItemsService],
  exports: [BudgetItemsService],
})
export class BudgetItemsModule {}
