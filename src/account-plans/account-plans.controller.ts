import { Body, Controller, Delete, Get, Param, Post, Put, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { AccountPlansService } from './account-plans.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role, AccountPlanType } from '@prisma/client';
import { UpdateAccountPlanDto } from './dto/update-account-plan.dto';

@ApiTags('contas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('contas')
export class AccountPlansController {
  constructor(private readonly service: AccountPlansService) {}

  @Get()
  @Roles(Role.ADMIN, Role.CONTROLLER)
  async list(
    @Query('search') search?: string,
    @Query('tipo') tipo?: AccountPlanType,
    @Query('parentId') parentId?: string,
    @Query('nivel') nivel?: string,
    @Query('tree') tree?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.list({
      search,
      tipo: tipo as AccountPlanType,
      parentId,
      nivel: nivel ? Number(nivel) : undefined,
      tree: tree === 'true',
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Post('import')
  @Roles(Role.ADMIN, Role.CONTROLLER)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async import(@UploadedFile() file: Express.Multer.File) {
    return this.service.importFromXlsx(file);
  }

  @Put(':id')
  @Roles(Role.ADMIN, Role.CONTROLLER)
  async update(@Param('id') id: string, @Body() dto: UpdateAccountPlanDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.CONTROLLER)
  async deactivate(@Param('id') id: string) {
    return this.service.deactivate(id);
  }
}
