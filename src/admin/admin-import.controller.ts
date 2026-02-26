import { Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { importRealizadoBaseline2026, resolveRealizadoBaselineFile } from '../dre/realized-baseline.importer';
import { importHistoricalPlanning } from '../planning/historical-importer';

@ApiTags('admin-import')
@ApiBearerAuth()
@Controller('admin/import')
export class AdminImportController {
  constructor(private readonly prisma: PrismaService) {}

  @Roles(Role.ADMIN)
  @Post('realizado-2026')
  async importRealizado2026() {
    const filePath = resolveRealizadoBaselineFile();
    if (!filePath) {
      return { ok: false, message: 'Arquivo baseline nao encontrado' };
    }
    const summary = await importRealizadoBaseline2026(this.prisma as any, filePath);
    return { ok: true, summary };
  }

  @Roles(Role.ADMIN)
  @Post('bootstrap')
  async importBootstrap() {
    const summary = await importHistoricalPlanning(this.prisma as any, process.cwd());
    return { ok: true, summary };
  }
}
