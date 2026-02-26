import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { BscController } from './bsc.controller';
import { BscService } from './bsc.service';
import { BscExcelImportService } from './import/BscExcelImportService';
import { BscImportsRepo } from './repositories/bscImports.repo';
import { BscPerspectiveRepo } from './repositories/bscPerspective.repo';
import { BscObjectiveRepo } from './repositories/bscObjective.repo';
import { BscIndicatorRepo } from './repositories/bscIndicator.repo';
import { BscTargetsRepo } from './repositories/bscTargets.repo';
import { BscActualsRepo } from './repositories/bscActuals.repo';
import { BscActionPlansRepo } from './repositories/bscActionPlans.repo';
import { BscProjectsRepo } from './repositories/bscProjects.repo';
import { BscTasksRepo } from './repositories/bscTasks.repo';
import { BscSnapshotsRepo } from './repositories/bscSnapshots.repo';

@Module({
  imports: [PrismaModule],
  controllers: [BscController],
  providers: [
    BscService,
    BscExcelImportService,
    BscImportsRepo,
    BscPerspectiveRepo,
    BscObjectiveRepo,
    BscIndicatorRepo,
    BscTargetsRepo,
    BscActualsRepo,
    BscActionPlansRepo,
    BscProjectsRepo,
    BscTasksRepo,
    BscSnapshotsRepo,
  ],
  exports: [BscExcelImportService, BscService],
})
export class BscModule {}
