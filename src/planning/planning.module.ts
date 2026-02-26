import { Module } from '@nestjs/common';
import { PlanningController } from './planning.controller';
import { PlanningService } from './planning.service';
import { PrismaModule } from '../prisma/prisma.module';
import { DreModule } from '../dre/dre.module';

@Module({
  imports: [PrismaModule, DreModule],
  controllers: [PlanningController],
  providers: [PlanningService],
})
export class PlanningModule {}
