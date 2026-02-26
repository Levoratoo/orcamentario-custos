import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ScenariosService } from './scenarios.service';
import { CreateScenarioDto } from './dto/create-scenario.dto';
import { UpdateScenarioDto } from './dto/update-scenario.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('scenarios')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('scenarios')
export class ScenariosController {
  constructor(private readonly service: ScenariosService) {}

  @Get()
  async list(@Query('status') status?: string) {
    return this.service.list(status);
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Roles(Role.ADMIN, Role.CONTROLLER)
  @Post()
  async create(@Body() dto: CreateScenarioDto, @CurrentUser() user: any) {
    return this.service.create(dto, user.sub);
  }

  @Roles(Role.ADMIN, Role.CONTROLLER)
  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateScenarioDto, @CurrentUser() user: any) {
    return this.service.update(id, dto, user.sub);
  }

  @Roles(Role.ADMIN, Role.CONTROLLER)
  @Post(':id/submit')
  async submit(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.submit(id, user.sub);
  }

  @Roles(Role.ADMIN, Role.CONTROLLER)
  @Post(':id/reopen')
  async reopen(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.reopen(id, user.sub);
  }

  @Roles(Role.ADMIN, Role.CONTROLLER)
  @Post(':id/approve')
  async approve(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.approve(id, user.sub);
  }

  @Roles(Role.ADMIN, Role.CONTROLLER)
  @Post(':id/lock')
  async lock(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.lock(id, user.sub);
  }
}
