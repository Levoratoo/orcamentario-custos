import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { DreService } from './dre.service';

@Controller('dre')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DreController {
  constructor(private readonly service: DreService) {}

  @Get('tree')
  @Roles(Role.ADMIN, Role.CONTROLLER, Role.COORDINATOR)
  getTree(
    @Query('budgetId') budgetId: string,
    @Query('mode') mode?: string,
    @Query('actualBudgetId') actualBudgetId?: string,
  ) {
    return this.service.getTree(budgetId, mode ?? 'BUDGET', actualBudgetId);
  }

  @Get('exercicio-acumulado')
  @Roles(Role.ADMIN, Role.CONTROLLER, Role.COORDINATOR)
  getExerciseAccumulated(
    @Query('year') year: string,
    @Query('cutoffMonth') cutoffMonth?: string,
  ) {
    return this.service.getExerciseAccumulated(Number(year), cutoffMonth ? Number(cutoffMonth) : undefined);
  }

  @Get('exercicio-mensal')
  @Roles(Role.ADMIN, Role.CONTROLLER, Role.COORDINATOR)
  getExerciseMonthly(
    @Query('year') year: string,
    @Query('month') month?: string,
  ) {
    return this.service.getExerciseMonthly(Number(year), month ? Number(month) : undefined);
  }

  @Get('audit')
  @Roles(Role.ADMIN, Role.CONTROLLER)
  auditAgainstExpandedSheet(
    @Query('year') year?: string,
    @Query('budgetId') budgetId?: string,
  ) {
    return this.service.auditAgainstExpandedSheet(year ? Number(year) : 2026, budgetId);
  }

  @Post('audit/fix')
  @Roles(Role.ADMIN, Role.CONTROLLER)
  autoFixFromExpandedSheet(
    @Body() body: { year?: number; budgetId?: string },
  ) {
    return this.service.autoFixFromExpandedSheet(body?.year ?? 2026, body?.budgetId);
  }
}
