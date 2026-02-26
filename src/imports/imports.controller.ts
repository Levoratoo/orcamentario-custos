import { Body, Controller, Get, Post, Query, UploadedFile, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { ImportsService } from './imports.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('imports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('imports')
export class ImportsController {
  constructor(private readonly service: ImportsService) {}

  @Roles(Role.ADMIN, Role.CONTROLLER, Role.COORDINATOR)
  @Post('budget-lines')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async importBudgetLines(
    @UploadedFile() file: Express.Multer.File,
    @Body('contentBase64') contentBase64: string,
    @CurrentUser() user: any,
  ) {
    return this.service.importBudgetLines({ file, contentBase64 }, user);
  }

  @Roles(Role.ADMIN, Role.CONTROLLER, Role.COORDINATOR)
  @Post('budget-scenario')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('files', 5))
  async importBudgetScenario(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('scenarioId') scenarioId: string,
    @CurrentUser() user: any,
  ) {
    return this.service.importBudgetScenario(files, user, scenarioId);
  }

  @Roles(Role.ADMIN, Role.CONTROLLER, Role.COORDINATOR)
  @Get('budget-scenario/latest')
  async getBudgetScenarioSnapshot(@Query('scenarioId') scenarioId: string) {
    return this.service.getBudgetScenarioSnapshot(scenarioId);
  }

  @Roles(Role.ADMIN, Role.CONTROLLER)
  @Post('budget-2026/preview')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async previewBudget2026(@UploadedFile() file: Express.Multer.File) {
    return this.service.previewBudget2026CoordinatorImport(file);
  }

  @Roles(Role.ADMIN, Role.CONTROLLER)
  @Post('budget-2026/commit')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async commitBudget2026(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: any) {
    return this.service.commitBudget2026CoordinatorImport(file, user);
  }
}
