import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ClosingMonthController } from './closing-month.controller';
import { ClosingMonthService } from './closing-month.service';

@Module({
  imports: [PrismaModule],
  controllers: [ClosingMonthController],
  providers: [ClosingMonthService],
  exports: [ClosingMonthService],
})
export class ClosingMonthModule {}
