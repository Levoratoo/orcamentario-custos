import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SponsorsService } from './sponsors.service';
import { CreateSponsorDto } from './dto/create-sponsor.dto';
import { UpdateSponsorDto } from './dto/update-sponsor.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class SponsorsController {
  constructor(private readonly service: SponsorsService) {}

  @Get('sponsors/my-accounts')
  @Roles(Role.ADMIN, Role.CONTROLLER, Role.COORDINATOR)
  myAccounts(@Query('budgetId') budgetId: string, @CurrentUser() user: any) {
    return this.service.listMyAccounts(budgetId, user);
  }

  @Get('accounts/:accountCode/budget-details')
  @Roles(Role.ADMIN, Role.CONTROLLER, Role.COORDINATOR)
  accountDetails(
    @Param('accountCode') accountCode: string,
    @Query('budgetId') budgetId: string,
    @Query('costCenterId') costCenterId: string | undefined,
    @CurrentUser() user: any,
  ) {
    return this.service.getAccountDetails(accountCode, budgetId, costCenterId ?? null, user);
  }

  @Get('admin/sponsors')
  @Roles(Role.ADMIN)
  listSponsors(@Query('query') query?: string) {
    return this.service.listSponsors(query);
  }

  @Post('admin/sponsors')
  @Roles(Role.ADMIN)
  createSponsor(@Body() dto: CreateSponsorDto) {
    return this.service.createSponsor(dto);
  }

  @Patch('admin/sponsors/:id')
  @Roles(Role.ADMIN)
  updateSponsor(@Param('id') id: string, @Body() dto: UpdateSponsorDto) {
    return this.service.updateSponsor(id, dto);
  }

  @Delete('admin/sponsors/:id')
  @Roles(Role.ADMIN)
  removeSponsor(@Param('id') id: string) {
    return this.service.deleteSponsor(id);
  }

  @Post('admin/sponsors/import')
  @Roles(Role.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  importSponsors(@UploadedFile() file: Express.Multer.File) {
    return this.service.importSponsors(file);
  }
}
