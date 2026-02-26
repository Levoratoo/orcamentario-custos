import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UpdateMeDto } from './dto/update-me.dto';
import { ChangePasswordDto } from '../auth/dto/change-password.dto';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async me(@CurrentUser() user: any) {
    return this.usersService.findById(user.sub);
  }

  @Patch('me')
  async updateMe(@CurrentUser() user: any, @Body() dto: UpdateMeDto) {
    return this.usersService.updateProfile(user.sub, dto);
  }

  @Patch('me/password')
  async updateMyPassword(@CurrentUser() user: any, @Body() dto: ChangePasswordDto) {
    return this.usersService.changeMyPassword(user.sub, dto.currentPassword, dto.newPassword);
  }

  @Roles(Role.ADMIN)
  @Get('users')
  async list(@Query('page') page = '1', @Query('pageSize') pageSize = '20') {
    return this.usersService.list(Number(page), Number(pageSize));
  }

  @Roles(Role.ADMIN)
  @Get('users/:id')
  async get(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Roles(Role.ADMIN)
  @Post('users')
  async create(@Body() dto: CreateUserDto, @CurrentUser() user: any) {
    return this.usersService.create(dto, user.sub);
  }

  @Roles(Role.ADMIN)
  @Put('users/:id')
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentUser() user: any) {
    return this.usersService.update(id, dto, user.sub);
  }

  @Roles(Role.ADMIN)
  @Delete('users/:id')
  async deactivate(@Param('id') id: string, @CurrentUser() user: any) {
    return this.usersService.deactivate(id, user.sub);
  }
}
