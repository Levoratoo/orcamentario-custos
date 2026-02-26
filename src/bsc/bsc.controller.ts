import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { BscImportService } from './bsc-import.service';
import { BscService } from './bsc.service';

@ApiTags('bsc')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('bsc')
export class BscController {
  constructor(
    private readonly importService: BscImportService,
    private readonly bscService: BscService,
  ) {}

  @Roles(Role.ADMIN, Role.CONTROLLER)
  @Post('import')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async import(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: any) {
    return this.importService.importExcel(file, user?.sub);
  }

  @Get('imports')
  async imports() {
    return this.importService.listImports();
  }

  @Get('imports/:id')
  async importById(@Param('id') id: string) {
    return this.importService.getImport(id);
  }

  @Get('map')
  async map() {
    return this.bscService.getMap();
  }

  @Get('indicators')
  async indicators(
    @Query('perspective') perspective?: string,
    @Query('objective') objective?: string,
    @Query('responsible') responsible?: string,
    @Query('process') process?: string,
    @Query('search') search?: string,
  ) {
    return this.bscService.getIndicators({
      perspective,
      objective,
      responsible,
      process,
      search,
    });
  }

  @Get('indicators/:code')
  async indicatorByCode(@Param('code') code: string) {
    return this.bscService.getIndicatorByCode(code);
  }

  @Get('management')
  async management(@Query('year') year = '2025') {
    return this.bscService.getManagement(Number(year));
  }

  @Get('management/summary')
  async managementSummary(@Query('year') year = '2025') {
    return this.bscService.getManagementSummary(Number(year));
  }

  @Get('projects')
  async projects(@Query('snapshot') snapshot?: string) {
    return this.bscService.getProjects(snapshot);
  }

  @Get('projects/snapshots')
  async projectSnapshots() {
    return this.bscService.getProjectSnapshots();
  }

  @Get('projects/:projectId/tasks')
  async projectTasks(@Param('projectId') projectId: string) {
    return this.bscService.getProjectTasks(projectId);
  }

  @Get('tasks/:taskId/snapshots')
  async taskSnapshots(@Param('taskId') taskId: string) {
    return this.bscService.getTaskSnapshots(taskId);
  }
}

