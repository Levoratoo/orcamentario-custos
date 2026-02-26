import { Body, Controller, Delete, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { BudgetItemsService } from './budget-items.service';
import { CreateBudgetItemDto } from './dto/create-budget-item.dto';
import { UpdateBudgetItemDto } from './dto/update-budget-item.dto';
import { UpdateBudgetItemValuesDto } from './dto/update-budget-item-values.dto';
import { ApplyValueDto } from './dto/apply-value.dto';
import { CopyFromMonthDto } from './dto/copy-from-month.dto';
import { DistributeTotalDto } from './dto/distribute-total.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('budget-items')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BudgetItemsController {
  constructor(private readonly service: BudgetItemsService) {}

  @Post()
  create(@Body() dto: CreateBudgetItemDto, @CurrentUser() user: any) {
    return this.service.create(dto, user);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateBudgetItemDto, @CurrentUser() user: any) {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.delete(id, user);
  }

  @Put(':id/values')
  updateValues(@Param('id') id: string, @Body() dto: UpdateBudgetItemValuesDto, @CurrentUser() user: any) {
    return this.service.updateValues(id, dto, user);
  }

  @Post(':id/apply-value')
  applyValue(@Param('id') id: string, @Body() dto: ApplyValueDto, @CurrentUser() user: any) {
    return this.service.applyValue(id, dto, user);
  }

  @Post(':id/copy-from-month')
  copyFromMonth(@Param('id') id: string, @Body() dto: CopyFromMonthDto, @CurrentUser() user: any) {
    return this.service.copyFromMonth(id, dto, user);
  }

  @Post(':id/distribute-total')
  distributeTotal(@Param('id') id: string, @Body() dto: DistributeTotalDto, @CurrentUser() user: any) {
    return this.service.distributeTotal(id, dto, user);
  }
}
