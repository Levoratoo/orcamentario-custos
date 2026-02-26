import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { BudgetsService } from './budgets.service';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';

@Controller('budgets')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BudgetsController {
  constructor(private readonly service: BudgetsService) {}

  @Get()
  @Roles(Role.ADMIN, Role.CONTROLLER, Role.COORDINATOR)
  list() {
    return this.service.list();
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.CONTROLLER, Role.COORDINATOR)
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Get(':id/imports')
  @Roles(Role.ADMIN, Role.CONTROLLER, Role.COORDINATOR)
  listImports(@Param('id') id: string) {
    return this.service.listImports(id);
  }

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateBudgetDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateBudgetDto) {
    return this.service.update(id, dto);
  }

  @Post(':id/import')
  @Roles(Role.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  import(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    return this.service.importFile(id, file);
  }

  @Post(':id/duplicate')
  @Roles(Role.ADMIN)
  duplicate(@Param('id') id: string) {
    return this.service.duplicate(id, true);
  }

  @Post(':id/set-active')
  @Roles(Role.ADMIN)
  setActive(@Param('id') id: string) {
    return this.service.setActive(id);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string) {
    return this.service.delete(id);
  }
}
