import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccountsService } from './accounts.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('accounts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('accounts')
export class AccountsController {
  constructor(private readonly service: AccountsService) {}

  @Get()
  async list(@Query('code') code?: string, @Query('category') category?: string) {
    return this.service.list({ code, category });
  }

  @Roles(Role.ADMIN, Role.CONTROLLER)
  @Post()
  async create(@Body() dto: CreateAccountDto, @CurrentUser() user: any) {
    return this.service.create(dto, user.sub);
  }

  @Roles(Role.ADMIN, Role.CONTROLLER)
  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateAccountDto, @CurrentUser() user: any) {
    return this.service.update(id, dto, user.sub);
  }
}
