import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';
import { BudgetKind, BudgetStatus, DreMode, Prisma } from '@prisma/client';
import { parseDreFile } from './budget-importer';

function inferYearFromColumns(columns: Array<{ label: string }>) {
  for (const col of columns) {
    const match = col.label.match(/(?:^|\D)(\d{2})\/(\d{4})(?:\D|$)/);
    if (match) {
      const year = Number(match[2]);
      if (Number.isFinite(year)) return year;
    }
  }
  return null;
}

@Injectable()
export class BudgetsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.budget.findMany({
      orderBy: [{ year: 'desc' }, { updatedAt: 'desc' }],
    });
  }

  async get(id: string) {
    const budget = await this.prisma.budget.findUnique({ where: { id } });
    if (!budget) {
      throw new NotFoundException({ code: 'BUDGET_NOT_FOUND', message: 'Budget not found' });
    }
    return budget;
  }

  async listImports(id: string) {
    await this.get(id);
    return this.prisma.budgetImport.findMany({
      where: { budgetId: id },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  async create(dto: CreateBudgetDto) {
    return this.prisma.budget.create({
      data: {
        name: dto.name,
        year: dto.year,
        kind: dto.kind ?? BudgetKind.BUDGET,
        notes: dto.notes,
        status: BudgetStatus.DRAFT,
      },
    });
  }

  async update(id: string, dto: UpdateBudgetDto) {
    await this.get(id);
    return this.prisma.budget.update({
      where: { id },
      data: {
        name: dto.name,
        year: dto.year,
        kind: dto.kind,
        status: dto.status,
        notes: dto.notes,
      },
    });
  }

  async delete(id: string) {
    await this.get(id);
    return this.prisma.budget.delete({ where: { id } });
  }

  async duplicate(id: string, copyLines = true) {
    const budget = await this.get(id);
    const clone = await this.prisma.budget.create({
      data: {
        name: `${budget.name} (copia)`,
        year: budget.year,
        kind: budget.kind,
        status: BudgetStatus.DRAFT,
        notes: budget.notes,
        version: 1,
      },
    });

    if (copyLines) {
      const lines = await this.prisma.dreLine.findMany({ where: { budgetId: id } });
      if (lines.length > 0) {
        await this.prisma.dreLine.createMany({
          data: lines.map((line) => ({
            budgetId: clone.id,
            nodeKey: line.nodeKey,
            parentKey: line.parentKey,
            level: line.level,
            sortOrder: line.sortOrder,
            accountCode: line.accountCode,
            accountName: line.accountName,
            groupPath: line.groupPath,
            month: line.month,
            mode: line.mode,
            value: line.value,
          })),
        });
        await this.prisma.budget.update({
          where: { id: clone.id },
          data: { status: BudgetStatus.READY },
        });
      }
    }

    return clone;
  }

  async setActive(id: string) {
    const budget = await this.get(id);
    await this.prisma.$transaction([
      this.prisma.budget.updateMany({
        where: { kind: budget.kind, isActive: true },
        data: { isActive: false },
      }),
      this.prisma.budget.update({
        where: { id },
        data: { isActive: true },
      }),
    ]);
    return { ok: true };
  }

  async importFile(id: string, file: Express.Multer.File) {
    const budget = await this.get(id);
    const nextVersion = budget.version + 1;

    await this.prisma.budget.update({
      where: { id },
      data: {
        status: BudgetStatus.PROCESSING,
        errorMessage: null,
      },
    });

    const importRecord = await this.prisma.budgetImport.create({
      data: {
        budgetId: id,
        version: nextVersion,
        fileName: file.originalname,
        status: BudgetStatus.PROCESSING,
      },
    });

    try {
      const parsed = parseDreFile(file.buffer, file.originalname);
      const rows = parsed.rows;
      const columns = parsed.columns;
      const yearFromFile = inferYearFromColumns(columns);
      const targetYear = yearFromFile ?? budget.year;

      const budgetLines: Prisma.DreLineCreateManyInput[] = [];
      const actualLines: Prisma.DreLineCreateManyInput[] = [];
      const stack: Array<{ level: number; key: string }> = [];

      rows.forEach((row, rowIndex) => {
        const label = row.label.replace(/\s+/g, ' ').trim();
        const match = label.match(/^(\d+(?:\.\d+)*)\s*-\s*(.+)$/);
        const accountCode = match?.[1];
        const accountName = (match?.[2] ?? label).trim();
        const nodeKey = `${accountCode ?? accountName}-${rowIndex}`;
        const level = row.level ?? 0;

        while (stack.length > 0 && stack[stack.length - 1].level >= level) {
          stack.pop();
        }
        const parentKey = stack.length > 0 ? stack[stack.length - 1].key : null;
        stack.push({ level, key: nodeKey });
        const groupPath = stack.map((item) => item.key).join(' > ');

        columns.forEach((col, colIndex) => {
          if (col.label === 'Total') return;
          if (!col.month) return;
          const value = Number(row.values?.[colIndex] ?? 0);
          const mode = col.mode ?? DreMode.PREVISTO;
          const payload: Prisma.DreLineCreateManyInput = {
            budgetId: id,
            nodeKey,
            parentKey,
            level,
            sortOrder: rowIndex,
            accountCode,
            accountName,
            groupPath,
            month: col.month,
            mode,
            value,
          };
          if (mode === DreMode.REALIZADO) {
            actualLines.push(payload);
          } else {
            budgetLines.push(payload);
          }
        });
      });

      if (budgetLines.length === 0 && actualLines.length === 0) {
        throw new BadRequestException({ code: 'BUDGET_IMPORT_EMPTY', message: 'Nenhuma linha encontrada.' });
      }

      const actualBudget = actualLines.length
        ? await this.prisma.budget.findFirst({
            where: { year: targetYear, kind: BudgetKind.ACTUAL },
            orderBy: { updatedAt: 'desc' },
          })
        : null;

      const ensureActualBudget = async () => {
        if (!actualLines.length) return null;
        if (actualBudget) return actualBudget;
        return this.prisma.budget.create({
          data: {
            name: `Realizado ${targetYear}`,
            year: targetYear,
            kind: BudgetKind.ACTUAL,
            status: BudgetStatus.READY,
            version: 1,
            isActive: false,
          },
        });
      };

      const actualTarget = await ensureActualBudget();

      const closingMonth = actualLines.length
        ? Math.max(...actualLines.map((line) => line.month ?? 0), 0)
        : null;

      await this.prisma.$transaction([
        this.prisma.dreLine.deleteMany({ where: { budgetId: id } }),
        budgetLines.length > 0 ? this.prisma.dreLine.createMany({ data: budgetLines }) : this.prisma.budget.findMany({ take: 0 }),
        this.prisma.budget.update({
          where: { id },
          data: {
            status: BudgetStatus.READY,
            version: nextVersion,
            fileName: file.originalname,
            errorMessage: null,
            year: targetYear,
          },
        }),
        this.prisma.budgetImport.update({
          where: { id: importRecord.id },
          data: { status: BudgetStatus.READY },
        }),
        actualTarget && actualLines.length > 0
          ? this.prisma.dreLine.deleteMany({ where: { budgetId: actualTarget.id } })
          : this.prisma.budget.findMany({ take: 0 }),
        actualTarget && actualLines.length > 0
          ? this.prisma.dreLine.createMany({
              data: actualLines.map((line) => ({ ...line, budgetId: actualTarget.id })),
            })
          : this.prisma.budget.findMany({ take: 0 }),
        actualTarget && actualLines.length > 0
          ? this.prisma.budget.update({
              where: { id: actualTarget.id },
              data: { status: BudgetStatus.READY },
            })
          : this.prisma.budget.findMany({ take: 0 }),
        closingMonth && targetYear
          ? this.prisma.closingMonth.upsert({
              where: { year_kind: { year: targetYear, kind: BudgetKind.ACTUAL } },
              update: { closingMonth },
              create: { year: targetYear, kind: BudgetKind.ACTUAL, closingMonth },
            })
          : this.prisma.budget.findMany({ take: 0 }),
      ]);

      return { ok: true, version: nextVersion };
    } catch (error: any) {
      await this.prisma.budget.update({
        where: { id },
        data: { status: BudgetStatus.ERROR, errorMessage: error?.message ?? 'Falha ao importar' },
      });
      await this.prisma.budgetImport.update({
        where: { id: importRecord.id },
        data: { status: BudgetStatus.ERROR, errorMessage: error?.message ?? 'Falha ao importar' },
      });
      throw error;
    }
  }
}
