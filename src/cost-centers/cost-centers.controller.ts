import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CostCentersService } from './cost-centers.service';
import { CreateCostCenterDto } from './dto/create-cost-center.dto';
import { UpdateCostCenterDto } from './dto/update-cost-center.dto';
import { SetOwnerDto } from './dto/set-owner.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('cost-centers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('cost-centers')
export class CostCentersController {
  constructor(private readonly service: CostCentersService) {}

  @Get()
  async list(@Query('code') code?: string, @Query('ownerId') ownerId?: string) {
    return this.service.list({ code, ownerId });
  }

  @Roles(Role.ADMIN, Role.CONTROLLER)
  @Post()
  async create(@Body() dto: CreateCostCenterDto, @CurrentUser() user: any) {
    return this.service.create(dto, user.sub);
  }

  @Roles(Role.ADMIN, Role.CONTROLLER)
  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateCostCenterDto, @CurrentUser() user: any) {
    return this.service.update(id, dto, user.sub);
  }

  @Roles(Role.ADMIN, Role.CONTROLLER)
  @Put(':id/owner')
  async setOwner(@Param('id') id: string, @Body() dto: SetOwnerDto, @CurrentUser() user: any) {
    return this.service.setOwner(id, dto.ownerCoordinatorId ?? null, user.sub);
  }
}
