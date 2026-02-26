import { Body, Controller, Get, Patch, Query, UseGuards } from '@nestjs/common';
import { BudgetKind, Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ClosingMonthService } from './closing-month.service';

@Controller('closing-month')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClosingMonthController {
  constructor(private readonly service: ClosingMonthService) {}

  @Get()
  @Roles(Role.ADMIN, Role.CONTROLLER, Role.COORDINATOR)
  get(@Query('year') year: string, @Query('kind') kind: string) {
    return this.service.get(Number(year), (kind as BudgetKind) ?? BudgetKind.ACTUAL);
  }

  @Patch()
  @Roles(Role.ADMIN)
  update(@Body() body: { year: number; closingMonth: number; kind?: BudgetKind }) {
    return this.service.set(body.year, body.kind ?? BudgetKind.ACTUAL, body.closingMonth);
  }
}
