import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BudgetStatus, DreMode, Role } from '@prisma/client';
import { CreateSponsorDto } from './dto/create-sponsor.dto';
import { UpdateSponsorDto } from './dto/update-sponsor.dto';
import * as xlsx from 'xlsx';
import { parse } from 'csv-parse/sync';

interface SponsorAccountRow {
  accountCode: string;
  accountName: string;
  costCenterId?: string | null;
  costCenterName?: string | null;
  sponsor: { userId?: string | null; display: string };
  actualPrevYearTotal: number;
  scenarioTotal: number;
  varPct: number | null;
  itemsCount: number;
  filledItemsCount: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'DONE';
}

@Injectable()
export class SponsorsService {
  constructor(private readonly prisma: PrismaService) {}

  private async getBudget(budgetId: string) {
    const budget = await this.prisma.budget.findUnique({ where: { id: budgetId } });
    if (!budget) {
      throw new NotFoundException({ code: 'BUDGET_NOT_FOUND', message: 'Budget not found' });
    }
    return budget;
  }

  private calcVarPct(main: number, compare: number) {
    if (!compare) return null;
    return ((main - compare) / Math.max(Math.abs(compare), 1)) * 100;
  }

  private async getPrevActualBudget(budgetYear: number) {
    return this.prisma.budget.findFirst({
      where: { year: budgetYear - 1, kind: 'ACTUAL', status: BudgetStatus.READY },
      orderBy: { updatedAt: 'desc' },
    });
  }

  private async ensureCanViewAccount(user: any, accountCode: string, costCenterId?: string | null) {
    if (user.role === Role.ADMIN) return;
    const sponsor = await this.prisma.accountSponsor.findFirst({
      where: {
        accountCode,
        sponsorUserId: user.sub,
        ...(costCenterId
          ? { OR: [{ costCenterId }, { costCenterId: null }] }
          : { costCenterId: null }),
      },
    });
    if (!sponsor) {
      throw new ForbiddenException({ code: 'NOT_SPONSOR', message: 'Not allowed to view this account' });
    }
  }

  async listMyAccounts(budgetId: string, user: any) {
    const budget = await this.getBudget(budgetId);
    const sponsors = await this.prisma.accountSponsor.findMany({
      where: user.role === Role.ADMIN ? {} : { sponsorUserId: user.sub },
      orderBy: { accountCode: 'asc' },
    });

    const accountCodes = Array.from(new Set(sponsors.map((s) => s.accountCode)));
    const accounts = await this.prisma.account.findMany({ where: { code: { in: accountCodes } } });
    const accountByCode = new Map(accounts.map((acc) => [acc.code, acc.name]));

    const costCenters = await this.prisma.costCenter.findMany();
    const costCenterById = new Map(costCenters.map((cc) => [cc.id, cc.name]));

    const items = await this.prisma.budgetItem.findMany({
      where: { budgetId, accountCode: { in: accountCodes } },
      include: { values: true },
    });

    const itemsByKey = new Map<string, typeof items>();
    items.forEach((item) => {
      const key = `${item.accountCode}::${item.costCenterId ?? 'none'}`;
      const list = itemsByKey.get(key) ?? [];
      list.push(item);
      itemsByKey.set(key, list);
    });

    const prevActual = await this.getPrevActualBudget(budget.year);
    const actualTotalsByAccount = new Map<string, number>();

    if (prevActual) {
      const actualLines = await this.prisma.dreLine.findMany({
        where: { budgetId: prevActual.id, accountCode: { in: accountCodes }, mode: DreMode.REALIZADO },
      });
      if (actualLines.length === 0) {
        const fallback = await this.prisma.dreLine.findMany({
          where: { budgetId: prevActual.id, accountCode: { in: accountCodes }, mode: DreMode.PREVISTO },
        });
        fallback.forEach((line) => {
          actualTotalsByAccount.set(line.accountCode ?? '', (actualTotalsByAccount.get(line.accountCode ?? '') ?? 0) + Number(line.value));
        });
      } else {
        actualLines.forEach((line) => {
          actualTotalsByAccount.set(line.accountCode ?? '', (actualTotalsByAccount.get(line.accountCode ?? '') ?? 0) + Number(line.value));
        });
      }
    }

    const rows: SponsorAccountRow[] = sponsors.map((sponsor) => {
      const key = `${sponsor.accountCode}::${sponsor.costCenterId ?? 'none'}`;
      const relatedItems = itemsByKey.get(key) ?? [];
      const itemsCount = relatedItems.length;
      const filledItemsCount = relatedItems.filter((item) => {
        const total = item.values.reduce((sum, value) => sum + Number(value.value), 0);
        return item.isActive && total !== 0;
      }).length;
      const scenarioTotal = relatedItems
        .filter((item) => item.isActive)
        .reduce((sum, item) => sum + item.values.reduce((acc, value) => acc + Number(value.value), 0), 0);
      const actualPrevYearTotal = actualTotalsByAccount.get(sponsor.accountCode) ?? 0;
      const varPct = this.calcVarPct(scenarioTotal, actualPrevYearTotal);
      const status: SponsorAccountRow['status'] =
        itemsCount === 0 || scenarioTotal === 0
          ? 'PENDING'
          : relatedItems.some((item) => item.isActive && item.values.reduce((sum, value) => sum + Number(value.value), 0) === 0)
            ? 'IN_PROGRESS'
            : 'DONE';
      return {
        accountCode: sponsor.accountCode,
        accountName: accountByCode.get(sponsor.accountCode) ?? sponsor.accountCode,
        costCenterId: sponsor.costCenterId,
        costCenterName: sponsor.costCenterId ? costCenterById.get(sponsor.costCenterId) ?? null : null,
        sponsor: { userId: sponsor.sponsorUserId, display: sponsor.sponsorDisplay },
        actualPrevYearTotal,
        scenarioTotal,
        varPct,
        itemsCount,
        filledItemsCount,
        status,
      };
    });

    return { budgetId, rows };
  }

  async getAccountDetails(accountCode: string, budgetId: string, costCenterId: string | null, user: any) {
    const budget = await this.getBudget(budgetId);
    await this.ensureCanViewAccount(user, accountCode, costCenterId);

    const account = await this.prisma.account.findUnique({ where: { code: accountCode } });
    const costCenter = costCenterId ? await this.prisma.costCenter.findUnique({ where: { id: costCenterId } }) : null;

    const items = await this.prisma.budgetItem.findMany({
      where: { budgetId, accountCode, costCenterId: costCenterId ?? null },
      include: { values: true },
      orderBy: { createdAt: 'asc' },
    });

    const itemsPayload = items.map((item) => {
      const monthValues: Record<number, number> = {};
      item.values.forEach((value) => {
        monthValues[value.month] = Number(value.value);
      });
      const total = Object.values(monthValues).reduce((sum, value) => sum + value, 0);
      return {
        id: item.id,
        itemName: item.itemName,
        isActive: item.isActive,
        isReimbursement: item.isReimbursement,
        comment: item.comment,
        monthValues,
        total,
      };
    });

    const scenarioMonthly = Array.from({ length: 12 }, (_, index) => {
      const month = index + 1;
      const value = items
        .filter((item) => item.isActive)
        .reduce((sum, item) => {
          const entry = item.values.find((val) => val.month === month);
          return sum + Number(entry?.value ?? 0);
        }, 0);
      return { month, value };
    });
    const scenarioTotal = scenarioMonthly.reduce((sum, entry) => sum + entry.value, 0);

    const prevActual = await this.getPrevActualBudget(budget.year);
    let actualPrevYearMonthly = Array.from({ length: 12 }, (_, index) => ({ month: index + 1, value: 0 }));
    if (prevActual) {
      const lines = await this.prisma.dreLine.findMany({
        where: { budgetId: prevActual.id, accountCode, mode: DreMode.REALIZADO },
      });
      const fallback = lines.length === 0
        ? await this.prisma.dreLine.findMany({ where: { budgetId: prevActual.id, accountCode, mode: DreMode.PREVISTO } })
        : lines;
      const monthlyMap = new Map<number, number>();
      fallback.forEach((line) => {
        if (!line.month) return;
        monthlyMap.set(line.month, (monthlyMap.get(line.month) ?? 0) + Number(line.value));
      });
      actualPrevYearMonthly = actualPrevYearMonthly.map((entry) => ({
        month: entry.month,
        value: monthlyMap.get(entry.month) ?? 0,
      }));
    }

    const actualPrevYearTotal = actualPrevYearMonthly.reduce((sum, entry) => sum + entry.value, 0);
    const varPctTotal = this.calcVarPct(scenarioTotal, actualPrevYearTotal);
    const varPctMonthly = scenarioMonthly.map((entry) => ({
      month: entry.month,
      value: this.calcVarPct(entry.value, actualPrevYearMonthly.find((a) => a.month === entry.month)?.value ?? 0),
    }));

    return {
      budget: { id: budget.id, name: budget.name, year: budget.year },
      account: { code: accountCode, name: account?.name ?? accountCode },
      costCenter: costCenter ? { id: costCenter.id, name: costCenter.name } : null,
      permission: { canEdit: user.role === Role.ADMIN || user.role === Role.CONTROLLER || user.role === Role.COORDINATOR, isAdmin: user.role === Role.ADMIN },
      items: itemsPayload,
      totals: {
        scenarioTotal,
        scenarioMonthly,
        actualPrevYearTotal,
        actualPrevYearMonthly,
        varPctTotal,
        varPctMonthly,
      },
    };
  }

  async listSponsors(query?: string) {
    if (!query) {
      return this.prisma.accountSponsor.findMany({ orderBy: { accountCode: 'asc' } });
    }
    return this.prisma.accountSponsor.findMany({
      where: {
        OR: [
          { accountCode: { contains: query, mode: 'insensitive' } },
          { sponsorDisplay: { contains: query, mode: 'insensitive' } },
        ],
      },
      orderBy: { accountCode: 'asc' },
    });
  }

  async createSponsor(dto: CreateSponsorDto) {
    let display = dto.sponsorDisplay?.trim();
    if (dto.sponsorUserId) {
      const user = await this.prisma.user.findUnique({ where: { id: dto.sponsorUserId } });
      display = display || user?.name || 'Sponsor';
    }
    if (!display) {
      throw new BadRequestException({ code: 'SPONSOR_DISPLAY_REQUIRED', message: 'Sponsor display required' });
    }
    return this.prisma.accountSponsor.create({
      data: {
        accountCode: dto.accountCode,
        costCenterId: dto.costCenterId ?? null,
        sponsorUserId: dto.sponsorUserId ?? null,
        sponsorDisplay: display,
      },
    });
  }

  async updateSponsor(id: string, dto: UpdateSponsorDto) {
    const sponsor = await this.prisma.accountSponsor.findUnique({ where: { id } });
    if (!sponsor) {
      throw new NotFoundException({ code: 'SPONSOR_NOT_FOUND', message: 'Sponsor not found' });
    }
    return this.prisma.accountSponsor.update({
      where: { id },
      data: {
        accountCode: dto.accountCode,
        costCenterId: dto.costCenterId,
        sponsorUserId: dto.sponsorUserId,
        sponsorDisplay: dto.sponsorDisplay,
      },
    });
  }

  async deleteSponsor(id: string) {
    await this.prisma.accountSponsor.delete({ where: { id } });
    return { ok: true };
  }

  async importSponsors(file: Express.Multer.File) {
    const rows = this.parseSponsorFile(file);
    const costCenters = await this.prisma.costCenter.findMany();
    const costCenterByCode = new Map(costCenters.map((cc) => [cc.code, cc.id]));

    const results = [];
    for (const row of rows) {
      const costCenterId = row.costCenterCode ? costCenterByCode.get(row.costCenterCode) ?? null : null;
      const sponsorUser = row.sponsorEmail
        ? await this.prisma.user.findUnique({ where: { email: row.sponsorEmail } })
        : null;
      const display = row.sponsorDisplay ?? sponsorUser?.name ?? row.sponsorEmail ?? row.sponsorName ?? 'Sponsor';

      const existing = await this.prisma.accountSponsor.findFirst({
        where: { accountCode: row.accountCode, costCenterId },
      });
      if (existing) {
        await this.prisma.accountSponsor.update({
          where: { id: existing.id },
          data: {
            sponsorUserId: sponsorUser?.id ?? null,
            sponsorDisplay: display,
          },
        });
        results.push({ accountCode: row.accountCode, status: 'updated' });
      } else {
        await this.prisma.accountSponsor.create({
          data: {
            accountCode: row.accountCode,
            costCenterId,
            sponsorUserId: sponsorUser?.id ?? null,
            sponsorDisplay: display,
          },
        });
        results.push({ accountCode: row.accountCode, status: 'created' });
      }
    }
    return { total: results.length, results };
  }

  private parseSponsorFile(file: Express.Multer.File) {
    const ext = file.originalname.split('.').pop()?.toLowerCase();
    let rows: Array<Record<string, string>> = [];
    if (ext === 'csv') {
      const csvText = file.buffer.toString('utf8');
      const records = parse(csvText, { columns: true, skip_empty_lines: true });
      rows = records;
    } else {
      const workbook = xlsx.read(file.buffer, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      rows = xlsx.utils.sheet_to_json<Record<string, string>>(sheet);
    }

    return rows.map((row) => ({
      accountCode: String(row['CONTA'] ?? row['conta'] ?? row['Conta']).trim(),
      sponsorEmail: row['PADRINHO'] ?? row['padrinho'] ?? row['Sponsor'] ?? '',
      sponsorName: row['NOME'] ?? row['Nome'] ?? '',
      sponsorDisplay: row['DISPLAY'] ?? row['Display'] ?? '',
      costCenterCode: row['CENTRO_CUSTO'] ?? row['Centro_Custo'] ?? row['CUSTO'] ?? '',
    }));
  }
}
