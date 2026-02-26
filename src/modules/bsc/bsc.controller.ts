import {
  Body,
  Controller,
  Get,
  Patch,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { FileInterceptor } from '@nestjs/platform-express';
import { BSC_BASE_ROUTE } from './bsc.routes';
import { BscService } from './bsc.service';
import { BscExcelImportService } from './import/BscExcelImportService';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UpdateIndicatorMonthActualDto } from './dto/update-indicator-month-actual.dto';
import { UpdateIndicatorMonthTargetDto } from './dto/update-indicator-month-target.dto';

@ApiTags('bsc')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller(BSC_BASE_ROUTE)
export class BscController {
  constructor(
    private readonly bscService: BscService,
    private readonly importService: BscExcelImportService,
  ) {}

  @Roles(Role.ADMIN, Role.CONTROLLER)
  @Post('import')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  importExcel(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: any,
    @Query('force') force?: string,
  ) {
    const forceImport = force === '1' || force?.toLowerCase() === 'true';
    return this.importService.importExcel(file, user?.sub, forceImport);
  }

  @Get('imports')
  listImports() {
    return this.importService.listImports();
  }

  @Get('imports/:id')
  getImport(@Param('id') id: string) {
    return this.importService.getImport(id);
  }

  @Get('map')
  getMap() {
    return this.bscService.getMap();
  }

  @Get('indicators')
  getIndicators(
    @Query('perspective') perspective?: string,
    @Query('objective') objective?: string,
    @Query('responsible') responsible?: string,
    @Query('dataOwner') dataOwner?: string,
    @Query('process') process?: string,
    @Query('level') level?: string,
    @Query('keyword') keyword?: string,
    @Query('search') search?: string,
  ) {
    const parsedLevel = level ? Number(level) : undefined;
    return this.bscService.getIndicators({
      perspective,
      objective,
      responsible,
      dataOwner,
      process,
      level: parsedLevel != null && Number.isFinite(parsedLevel) ? parsedLevel : undefined,
      keyword,
      search,
    });
  }

  @Get('indicators/:code')
  getIndicatorByCode(@Param('code') code: string) {
    return this.bscService.getIndicatorByCode(code);
  }

  @Roles(Role.ADMIN, Role.CONTROLLER)
  @Patch('indicators/:code/month-actual')
  setIndicatorMonthActual(
    @Param('code') code: string,
    @Body() body: UpdateIndicatorMonthActualDto,
  ) {
    return this.bscService.setIndicatorMonthActual(code, body);
  }

  @Roles(Role.ADMIN, Role.CONTROLLER)
  @Patch('indicators/:code/month-target')
  setIndicatorMonthTarget(
    @Param('code') code: string,
    @Body() body: UpdateIndicatorMonthTargetDto,
  ) {
    return this.bscService.setIndicatorMonthTarget(code, body);
  }

  @Get('management')
  getManagement(@Query('year') year = '2025') {
    return this.bscService.getManagement(Number(year));
  }

  @Get('management/summary')
  getManagementSummary(@Query('year') year = '2025') {
    return this.bscService.getManagementSummary(Number(year));
  }

  @Get('projects')
  getProjects(@Query('snapshot') snapshot?: string) {
    return this.bscService.getProjects(snapshot);
  }

  @Get('projects/snapshots')
  getProjectSnapshots() {
    return this.bscService.getProjectSnapshots();
  }

  @Get('projects/:projectId/tasks')
  getProjectTasks(@Param('projectId') projectId: string) {
    return this.bscService.getProjectTasks(projectId);
  }

  @Get('tasks/:taskId/snapshots')
  getTaskSnapshots(@Param('taskId') taskId: string) {
    return this.bscService.getTaskSnapshots(taskId);
  }
}
