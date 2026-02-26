import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BudgetLinesService } from './budget-lines.service';
import { CreateBudgetLineDto } from './dto/create-budget-line.dto';
import { UpdateBudgetLineDto } from './dto/update-budget-line.dto';
import { BulkUpsertDto } from './dto/bulk-upsert.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('budget-lines')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('budget-lines')
export class BudgetLinesController {
  constructor(private readonly service: BudgetLinesService) {}

  @Roles(Role.ADMIN, Role.CONTROLLER, Role.COORDINATOR)
  @Post()
  async create(@Body() dto: CreateBudgetLineDto, @CurrentUser() user: any) {
    return this.service.create(dto, user);
  }

  @Roles(Role.ADMIN, Role.CONTROLLER, Role.COORDINATOR)
  @Get()
  async list(
    @Query('scenarioId') scenarioId?: string,
    @Query('costCenterId') costCenterId?: string,
    @Query('accountId') accountId?: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @CurrentUser() user?: any,
  ) {
    return this.service.list({ scenarioId, costCenterId, accountId }, user, Number(page), Number(pageSize));
  }

  @Roles(Role.ADMIN, Role.CONTROLLER, Role.COORDINATOR)
  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateBudgetLineDto, @CurrentUser() user: any) {
    return this.service.update(id, dto, user);
  }

  @Roles(Role.ADMIN, Role.CONTROLLER, Role.COORDINATOR)
  @Delete(':id')
  async delete(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.delete(id, user);
  }

  @Roles(Role.ADMIN, Role.CONTROLLER, Role.COORDINATOR)
  @Post('bulk-upsert')
  async bulkUpsert(@Body() dto: BulkUpsertDto, @CurrentUser() user: any) {
    return this.service.bulkUpsert(dto, user);
  }

  @Roles(Role.ADMIN, Role.CONTROLLER, Role.COORDINATOR)
  @Get('summary')
  async summary(
    @Query('scenarioId') scenarioId: string,
    @Query('groupBy') groupBy: 'costCenter' | 'account' | 'category' = 'costCenter',
    @CurrentUser() user: any,
  ) {
    return this.service.summary(scenarioId, groupBy, user);
  }
}
