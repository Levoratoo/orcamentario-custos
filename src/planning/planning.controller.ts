import { Body, Controller, Get, Patch, Post, Query, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { PlanningService } from './planning.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UpdatePlanningValueDto } from './dto/update-planning-value.dto';
import { FinalizePlanningDto } from './dto/finalize-planning.dto';

@ApiTags('planning')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('planning')
export class PlanningController {
  constructor(private readonly planningService: PlanningService) {}

  @Get('proacoes')
  async listProacoes(@CurrentUser() user: any, @Query('userId') userId?: string) {
    return this.planningService.listProacoes(user, userId);
  }

  @Get('years')
  async listYears(@CurrentUser() user: any, @Query('userId') userId?: string) {
    return this.planningService.listYears(user, userId);
  }

  @Get('grid')
  async getGrid(
    @CurrentUser() user: any,
    @Query('proacaoId') proacaoId: string,
    @Query('year') year: string,
    @Query('userId') userId?: string,
  ) {
    return this.planningService.getGrid(user, proacaoId, Number(year), userId);
  }

  @Get('summary')
  async summary(
    @CurrentUser() user: any,
    @Query('proacaoId') proacaoId: string,
    @Query('year') year: string,
    @Query('userId') userId?: string,
  ) {
    return this.planningService.getSummary(user, proacaoId, Number(year), userId);
  }

  @Get('audit')
  async audit(
    @CurrentUser() user: any,
    @Query('proacaoId') proacaoId: string,
    @Query('year') year: string,
    @Query('userId') userId?: string,
  ) {
    return this.planningService.auditConsistency(user, proacaoId, Number(year), userId);
  }

  @Patch('value')
  async updateValue(@CurrentUser() user: any, @Body() dto: UpdatePlanningValueDto) {
    return this.planningService.updateValue(user, dto);
  }

  @Post('finalize')
  async finalize(@CurrentUser() user: any, @Body() dto: FinalizePlanningDto) {
    return this.planningService.finalize(user, dto);
  }

  @Roles(Role.ADMIN)
  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  async import(@UploadedFile() file: Express.Multer.File | undefined, @CurrentUser() user: any) {
    if (!file) {
      return { inserted: 0, updated: 0, skipped: 0 };
    }
    return this.planningService.importFromXlsx(file, user.sub);
  }
}
