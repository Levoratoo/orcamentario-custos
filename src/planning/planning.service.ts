import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BudgetKind, BudgetStatus, Role } from '@prisma/client';
import { UpdatePlanningValueDto } from './dto/update-planning-value.dto';
import { importPlanningXlsx } from './planning.importer';
import { FinalizePlanningDto } from './dto/finalize-planning.dto';
import { DreService } from '../dre/dre.service';

@Injectable()
export class PlanningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dreService: DreService,
  ) {}

  private readonly months = Array.from({ length: 12 }, (_, index) => index + 1);

  private normalizeProacaoName(value: string) {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
  }

  async listProacoes(user: { sub: string; role: Role }, userId?: string) {
    const targetUserId = user.role === Role.ADMIN ? userId : user.sub;
    const where: any = {};
    if (targetUserId) {
      where.accounts = { some: { ownerUserId: targetUserId } };
    }

    const proacoes = await this.prisma.proacao.findMany({
      where,
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });

    const withValueCount = await Promise.all(
      proacoes.map(async (proacao) => {
        const valueCount = await this.prisma.planningValue.count({
          where: {
            account: {
              proacaoId: proacao.id,
              ...(targetUserId ? { ownerUserId: targetUserId } : {}),
            },
          },
        });
        return { ...proacao, valueCount };
      }),
    );

    const deduped = new Map<string, { id: string; name: string; valueCount: number }>();
    for (const item of withValueCount) {
      if (item.valueCount <= 0) continue;
      const key = this.normalizeProacaoName(item.name);
      const existing = deduped.get(key);
      if (!existing || item.valueCount > existing.valueCount) {
        deduped.set(key, item);
      }
    }

    return Array.from(deduped.values())
      .sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'))
      .map(({ id, name }) => ({ id, name }));
  }

  async listYears(user: { sub: string; role: Role }, userId?: string) {
    const isAdmin = user.role === Role.ADMIN;
    const targetUserId = isAdmin ? userId : user.sub;

    const where: any = {};
    if (targetUserId) {
      where.account = { ownerUserId: targetUserId };
    }

    const years = await this.prisma.planningValue.findMany({
      where,
      distinct: ['year'],
      select: { year: true },
      orderBy: { year: 'asc' },
    });

    const currentYear = new Date().getFullYear();
    const list = years.map((item) => item.year);
    if (!list.includes(currentYear)) {
      list.push(currentYear);
    }
    return list.sort((a, b) => a - b);
  }

  async getGrid(user: { sub: string; role: Role }, proacaoId: string, year: number, userId?: string) {
    const isAll = proacaoId === 'all';
    const proacao = isAll
      ? { id: 'all', name: 'Todos' }
      : await this.prisma.proacao.findUnique({ where: { id: proacaoId } });
    if (!proacao) {
      throw new NotFoundException({ code: 'PROACAO_NOT_FOUND', message: 'Pro acao nao encontrada' });
    }

    const accountWhere: any = {};
    if (!isAll) {
      accountWhere.proacaoId = proacaoId;
    }
    accountWhere.values = { some: { year } };
    if (user.role === Role.ADMIN) {
      if (userId) {
        accountWhere.ownerUserId = userId;
      }
    } else {
      accountWhere.ownerUserId = user.sub;
    }

    const accounts = await this.prisma.planningAccount.findMany({
      where: accountWhere,
      orderBy: { orderIndex: 'asc' },
      include: { values: { where: { year } } },
    });

    const rows = accounts.map((account) => {
      const monthValues: Record<number, number> = {};
      const monthLocked: Record<number, boolean> = {};
      for (let month = 1; month <= 12; month += 1) {
        monthValues[month] = 0;
        monthLocked[month] = false;
      }
      account.values.forEach((value) => {
        monthValues[value.month] = Number(value.value);
        monthLocked[value.month] = Boolean(value.locked);
      });
      const total = Object.values(monthValues).reduce((sum, value) => sum + value, 0);
      return {
        id: account.id,
        code: account.code,
        label: account.label,
        name: account.name,
        ownerUserId: account.ownerUserId,
        orderIndex: account.orderIndex,
        values: monthValues,
        lockedByMonth: monthLocked,
        total,
      };
    });

    const grandTotal = rows.reduce((sum, row) => sum + row.total, 0);

    return {
      proacao,
      year,
      accounts: rows,
      totals: { grandTotal },
    };
  }

  async updateValue(user: { sub: string; role: Role }, dto: UpdatePlanningValueDto) {
    const account = await this.prisma.planningAccount.findUnique({ where: { id: dto.accountId } });
    if (!account) {
      throw new NotFoundException({ code: 'ACCOUNT_NOT_FOUND', message: 'Conta nao encontrada' });
    }
    if (user.role !== Role.ADMIN) {
      const assignment = await this.prisma.userAccountAssignment.findUnique({
        where: { userId_accountId: { userId: user.sub, accountId: dto.accountId } },
      });
      if (!assignment) {
        throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Sem permissao para editar esta conta' });
      }
    }

    const existingValue = await this.prisma.planningValue.findUnique({
      where: {
        accountId_year_month: {
          accountId: dto.accountId,
          year: dto.year,
          month: dto.month,
        },
      },
    });

    if (existingValue?.locked && user.role !== Role.ADMIN) {
      throw new ForbiddenException({ code: 'LOCKED', message: 'Valor bloqueado para edicao' });
    }

    const value = await this.prisma.planningValue.upsert({
      where: {
        accountId_year_month: {
          accountId: dto.accountId,
          year: dto.year,
          month: dto.month,
        },
      },
      create: {
        accountId: dto.accountId,
        year: dto.year,
        month: dto.month,
        value: dto.value,
        updatedById: user.sub,
        source: 'MANUAL',
        locked: false,
      },
      update: {
        value: dto.value,
        updatedById: user.sub,
        source: 'MANUAL',
        locked: existingValue?.locked ?? false,
        sourceFile: null,
      },
    });

    return {
      accountId: dto.accountId,
      year: dto.year,
      month: dto.month,
      value: Number(value.value),
    };
  }

  async finalize(user: { sub: string; role: Role }, dto: FinalizePlanningDto) {
    const isAdmin = user.role === Role.ADMIN;
    if (!isAdmin && dto.userId && dto.userId !== user.sub) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Sem permissao para este usuario' });
    }

    const targetUserId = isAdmin ? dto.userId ?? user.sub : user.sub;
    const where: any = {
      ownerUserId: targetUserId,
    };
    if (dto.proacaoId !== 'all') {
      where.proacaoId = dto.proacaoId;
    }

    const accounts = await this.prisma.planningAccount.findMany({
      where,
      select: { id: true },
    });

    if (accounts.length === 0) {
      return {
        ok: true,
        year: dto.year,
        proacaoId: dto.proacaoId,
        targetUserId,
        lockedCells: 0,
        accounts: 0,
      };
    }

    const accountIds = accounts.map((item) => item.id);
    const existing = await this.prisma.planningValue.findMany({
      where: {
        accountId: { in: accountIds },
        year: dto.year,
      },
      select: {
        accountId: true,
        month: true,
        value: true,
      },
    });

    const valueMap = new Map<string, number>();
    existing.forEach((item) => {
      valueMap.set(`${item.accountId}-${item.month}`, Number(item.value));
    });

    const ops = [];
    for (const accountId of accountIds) {
      for (let month = 1; month <= 12; month += 1) {
        const key = `${accountId}-${month}`;
        const value = valueMap.get(key) ?? 0;
        ops.push(
          this.prisma.planningValue.upsert({
            where: {
              accountId_year_month: {
                accountId,
                year: dto.year,
                month,
              },
            },
            create: {
              accountId,
              year: dto.year,
              month,
              value,
              updatedById: user.sub,
              source: 'MANUAL',
              locked: true,
            },
            update: {
              value,
              updatedById: user.sub,
              locked: true,
            },
          }),
        );
      }
    }

    await this.prisma.$transaction(ops);

    return {
      ok: true,
      year: dto.year,
      proacaoId: dto.proacaoId,
      targetUserId,
      lockedCells: ops.length,
      accounts: accountIds.length,
    };
  }

  async importFromXlsx(file: Express.Multer.File, createdById: string) {
    return importPlanningXlsx(this.prisma, file.buffer, { defaultPassword: '123456', createdById });
  }

  private toNumber(value: unknown) {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return value;
    return Number(value) || 0;
  }

  async getSummary(
    user: { sub: string; role: Role },
    proacaoId: string,
    year: number,
    userId?: string,
  ) {
    if (!proacaoId) {
      throw new NotFoundException({ code: 'PROACAO_REQUIRED', message: 'Pro acao nao informada' });
    }
    const isAll = proacaoId === 'all';

    const isAdmin = user.role === Role.ADMIN;
    const targetUserId = isAdmin ? userId : user.sub;
    if (!isAdmin && userId && userId !== user.sub) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Sem permissao para este usuario' });
    }

    const accountWhere: any = {};
    if (!isAll) {
      accountWhere.proacaoId = proacaoId;
    }
    if (targetUserId) {
      accountWhere.ownerUserId = targetUserId;
    }

    const accounts = await this.prisma.planningAccount.findMany({
      where: accountWhere,
      select: { id: true, code: true },
    });

    const accountIds = accounts.map((account) => account.id);
    const accountCodes = Array.from(
      new Set(
        accounts
          .map((account) => String(account.code ?? '').trim())
          .filter(Boolean)
          .flatMap((code) => {
            const base = code.split('.')[0]?.trim() ?? '';
            return base && base !== code ? [code, base] : [code];
          }),
      ),
    );

    const [orcLancadoAgg, receitaAgg, monthlyCurrent, monthlyPrev] = await Promise.all([
      accountIds.length
        ? this.prisma.planningValue.aggregate({
            where: { accountId: { in: accountIds }, year },
            _sum: { value: true },
          })
        : Promise.resolve({ _sum: { value: 0 } }),
      this.prisma.revenueProjection.aggregate({
        where: { year },
        _sum: { value: true },
      }),
      accountIds.length
        ? this.prisma.planningValue.groupBy({
            by: ['month'],
            where: { accountId: { in: accountIds }, year },
            _sum: { value: true },
          })
        : Promise.resolve([]),
      accountIds.length
        ? this.prisma.planningValue.groupBy({
            by: ['month'],
            where: { accountId: { in: accountIds }, year: year - 1 },
            _sum: { value: true },
          })
        : Promise.resolve([]),
    ]);

    const orcLancado = this.toNumber(orcLancadoAgg._sum.value);
    const receitaLiquidaProjetada = this.toNumber(receitaAgg._sum.value);

    let orcMaximo = 0;
    if (!isAll) {
      const limit = await this.prisma.budgetLimit.findFirst({
        where: {
          year,
          proacaoId,
          userId: targetUserId ?? null,
        },
        orderBy: { updatedAt: 'desc' },
      });

      const fallbackLimit =
        limit ??
        (await this.prisma.budgetLimit.findFirst({
          where: { year, proacaoId, userId: null },
          orderBy: { updatedAt: 'desc' },
        }));

      orcMaximo = this.toNumber(fallbackLimit?.maxValue ?? 0);
    }
    const excedeuMaximo = orcMaximo > 0 && orcLancado > orcMaximo;
    const txVerbaAno = receitaLiquidaProjetada > 0 ? (orcLancado / receitaLiquidaProjetada) * 100 : null;

    const labels = this.months.map((month) => `${String(month).padStart(2, '0')}/${year}`);
    const seriesBase = new Array(12).fill(0);

    const plannedCurrentSeries = [...seriesBase];
    monthlyCurrent.forEach((item: any) => {
      if (item.month >= 1 && item.month <= 12) {
        plannedCurrentSeries[item.month - 1] = this.toNumber(item._sum.value);
      }
    });

    const plannedPrevSeries = [...seriesBase];
    monthlyPrev.forEach((item: any) => {
      if (item.month >= 1 && item.month <= 12) {
        plannedPrevSeries[item.month - 1] = this.toNumber(item._sum.value);
      }
    });

    const currentCalendarYear = new Date().getFullYear();
    const allowBudgetFallbackForCurrentYear = year < currentCalendarYear;

    const [realizedCurrentSeries, realizedPrevSeries] = await Promise.all([
      this.getRealizedFromDreByMonth(year, accountCodes, {
        allowBudgetFallback: allowBudgetFallbackForCurrentYear,
      }),
      this.getRealizedFromDreByMonth(year - 1, accountCodes, {
        allowBudgetFallback: true,
      }),
    ]);

    const sumSeries = (values: number[]) => values.reduce((acc, value) => acc + this.toNumber(value), 0);
    const fallbackPlannedCurrent =
      sumSeries(plannedCurrentSeries) === 0
        ? await this.getPlannedFromBudgetDreLinesByMonth(year, accountCodes)
        : null;
    const fallbackPlannedPrev =
      sumSeries(plannedPrevSeries) === 0
        ? await this.getPlannedFromBudgetDreLinesByMonth(year - 1, accountCodes)
        : null;
    const cenario = fallbackPlannedCurrent ?? plannedCurrentSeries;
    const orcadoAnoAnt = fallbackPlannedPrev ?? plannedPrevSeries;
    // Realizado in planning dashboard must come from DRE source of truth.
    const realizadoAnoAtual = realizedCurrentSeries;
    const realizadoAnoAnt = realizedPrevSeries;

    return {
      year,
      proacaoId,
      kpis: {
        receitaLiquidaProjetada,
        txVerbaAno,
        orcMaximo,
        orcLancado,
        excedeuMaximo,
      },
      chart: {
        labels,
        series: {
          orcadoAnoAtual: cenario,
          realizadoAnoAnt,
          realizadoAnoAtual,
          orcadoAnoAnt,
          cenario,
        },
      },
    };
  }

  async auditConsistency(
    user: { sub: string; role: Role },
    proacaoId: string,
    year: number,
    userId?: string,
  ) {
    if (!proacaoId) {
      throw new NotFoundException({ code: 'PROACAO_REQUIRED', message: 'Pro acao nao informada' });
    }
    const isAll = proacaoId === 'all';
    const isAdmin = user.role === Role.ADMIN;
    const targetUserId = isAdmin ? userId : user.sub;
    if (!isAdmin && userId && userId !== user.sub) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Sem permissao para este usuario' });
    }

    const accountWhere: any = {};
    if (!isAll) accountWhere.proacaoId = proacaoId;
    if (targetUserId) accountWhere.ownerUserId = targetUserId;
    accountWhere.values = { some: { year } };

    const planningAccounts = await this.prisma.planningAccount.findMany({
      where: accountWhere,
      include: { values: { where: { year } } },
      orderBy: { orderIndex: 'asc' },
    });

    const budget = await this.prisma.budget.findFirst({
      where: { year, kind: BudgetKind.BUDGET, status: BudgetStatus.READY },
      orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
    });
    if (!budget) {
      throw new NotFoundException({ code: 'BUDGET_NOT_FOUND', message: `Budget ${year} nao encontrado` });
    }

    const dreTree = await this.dreService.getTree(budget.id, 'DRE');
    const dreRows = dreTree.rows as Array<{
      id: string;
      codigo?: string | null;
      descricao: string;
      parentId?: string | null;
      valoresPorMes: Record<string, { previsto: number; realizado: number; projetado: number }>;
    }>;
    const dreById = new Map(dreRows.map((row) => [row.id, row]));

    const normalize = (value: string) =>
      String(value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/\s+/g, ' ')
        .trim();
    const toNumber = (value: unknown) => {
      const parsed = Number(value ?? 0);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const dreByLabel = new Map<string, typeof dreRows>();
    dreRows.forEach((row) => {
      const key = normalize(row.descricao);
      const list = dreByLabel.get(key) ?? [];
      list.push(row);
      dreByLabel.set(key, list);
    });

    const issues: Array<{
      id: string;
      type: 'ACCOUNT_MONTH_MISMATCH' | 'MISSING_DRE_ROW' | 'PARENT_ROLLUP_MISMATCH';
      severity: 'high' | 'medium';
      message: string;
      accountId?: string;
      accountCode?: string;
      accountLabel?: string;
      month?: number;
      planningValue?: number;
      dreValue?: number;
      delta?: number;
      canEdit: boolean;
    }> = [];

    planningAccounts.forEach((account) => {
      const accountValuesByMonth: Record<number, number> = {};
      this.months.forEach((month) => {
        accountValuesByMonth[month] = 0;
      });
      account.values.forEach((value) => {
        accountValuesByMonth[value.month] = toNumber(value.value);
      });

      const matchingDreRows = dreByLabel.get(normalize(account.label)) ?? [];
      if (matchingDreRows.length === 0) {
        issues.push({
          id: `missing:${account.id}`,
          type: 'MISSING_DRE_ROW',
          severity: 'high',
          message: `Conta "${account.label}" nao encontrada no DRE.`,
          accountId: account.id,
          accountCode: account.code,
          accountLabel: account.label,
          canEdit: false,
        });
        return;
      }

      this.months.forEach((month) => {
        const monthKey = `${year}-${String(month).padStart(2, '0')}`;
        const dreValue = matchingDreRows.reduce(
          (sum, row) => sum + toNumber(row.valoresPorMes?.[monthKey]?.previsto),
          0,
        );
        const planningValue = accountValuesByMonth[month] ?? 0;
        const delta = planningValue - dreValue;
        if (Math.abs(delta) > 0.02) {
          issues.push({
            id: `acc:${account.id}:${month}`,
            type: 'ACCOUNT_MONTH_MISMATCH',
            severity: 'high',
            message: `${account.label} (${String(month).padStart(2, '0')}/${year}) diverge entre Planejamento e DRE.`,
            accountId: account.id,
            accountCode: account.code,
            accountLabel: account.label,
            month,
            planningValue,
            dreValue,
            delta,
            canEdit: true,
          });
        }
      });
    });

    const childrenByParent = new Map<string, typeof dreRows>();
    dreRows.forEach((row) => {
      if (!row.parentId || !dreById.has(row.parentId)) return;
      const list = childrenByParent.get(row.parentId) ?? [];
      list.push(row);
      childrenByParent.set(row.parentId, list);
    });

    childrenByParent.forEach((children, parentId) => {
      const parent = dreById.get(parentId);
      if (!parent) return;
      this.months.forEach((month) => {
        const monthKey = `${year}-${String(month).padStart(2, '0')}`;
        const parentPrev = toNumber(parent.valoresPorMes?.[monthKey]?.previsto);
        const sumChildrenPrev = children.reduce(
          (sum, child) => sum + toNumber(child.valoresPorMes?.[monthKey]?.previsto),
          0,
        );
        const delta = parentPrev - sumChildrenPrev;
        if (Math.abs(delta) > 0.02) {
          issues.push({
            id: `rollup:${parent.id}:${month}`,
            type: 'PARENT_ROLLUP_MISMATCH',
            severity: 'medium',
            message: `Rollup inconsistente em "${parent.descricao}" (${String(month).padStart(2, '0')}/${year}).`,
            accountCode: parent.codigo ?? undefined,
            accountLabel: parent.descricao,
            month,
            planningValue: sumChildrenPrev,
            dreValue: parentPrev,
            delta,
            canEdit: false,
          });
        }
      });
    });

    const summary = {
      totalIssues: issues.length,
      high: issues.filter((item) => item.severity === 'high').length,
      medium: issues.filter((item) => item.severity === 'medium').length,
      editable: issues.filter((item) => item.canEdit).length,
    };

    return {
      year,
      proacaoId,
      userId: targetUserId ?? null,
      generatedAt: new Date().toISOString(),
      summary,
      issues: issues.slice(0, 500),
    };
  }

  private async getPlannedFromBudgetDreLinesByMonth(year: number, accountCodes: string[]) {
    if (accountCodes.length === 0) {
      return new Array(12).fill(0);
    }
    if (year === 2026) {
      const budget2026 = await this.prisma.budget.findFirst({
        where: { year, kind: BudgetKind.BUDGET, status: BudgetStatus.READY },
        orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
      });
      if (!budget2026) return new Array(12).fill(0);

      const tree = await this.dreService.getTree(budget2026.id, 'BUDGET');
      const codeSet = new Set(accountCodes.map((code) => String(code ?? '').trim()).filter(Boolean));
      const series = new Array(12).fill(0);
      (tree.rows as Array<any>).forEach((row) => {
        const code = String(row.codigo ?? '').trim();
        if (!codeSet.has(code)) return;
        for (let month = 1; month <= 12; month += 1) {
          const monthKey = `${year}-${String(month).padStart(2, '0')}`;
          series[month - 1] += this.toNumber(row.valoresPorMes?.[monthKey]?.previsto);
        }
      });
      return series;
    }
    const budget = await this.prisma.budget.findFirst({
      where: { year, kind: BudgetKind.BUDGET, status: BudgetStatus.READY },
      orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
    });
    if (!budget) return new Array(12).fill(0);
    const grouped = await this.prisma.dreLine.groupBy({
      by: ['month'],
      where: {
        budgetId: budget.id,
        mode: 'PREVISTO',
        accountCode: { in: accountCodes },
      },
      _sum: { value: true },
    });
    const series = new Array(12).fill(0);
    grouped.forEach((item) => {
      if (item.month >= 1 && item.month <= 12) {
        series[item.month - 1] = this.toNumber(item._sum.value);
      }
    });
    return series;
  }

  private async getRealizedFromDreByMonth(
    year: number,
    accountCodes: string[],
    options?: { allowBudgetFallback?: boolean },
  ) {
    if (accountCodes.length === 0) return new Array(12).fill(0);
    if (year === 2026) {
      const budget2026 = await this.prisma.budget.findFirst({
        where: { year, kind: BudgetKind.BUDGET, status: BudgetStatus.READY },
        orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
      });
      if (!budget2026) return new Array(12).fill(0);

      const tree = await this.dreService.getTree(budget2026.id, 'DRE');
      const codeSet = new Set(accountCodes.map((code) => String(code ?? '').trim()).filter(Boolean));
      const series = new Array(12).fill(0);
      (tree.rows as Array<any>).forEach((row) => {
        const code = String(row.codigo ?? '').trim();
        if (!codeSet.has(code)) return;
        for (let month = 1; month <= 12; month += 1) {
          const monthKey = `${year}-${String(month).padStart(2, '0')}`;
          series[month - 1] += this.toNumber(row.valoresPorMes?.[monthKey]?.realizado);
        }
      });
      return series;
    }

    const allowBudgetFallback = options?.allowBudgetFallback ?? true;

    const actualBudgets = await this.prisma.budget.findMany({
      where: {
        year,
        kind: BudgetKind.ACTUAL,
        status: BudgetStatus.READY,
      },
      orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
      select: { id: true, kind: true, isActive: true, updatedAt: true },
    });

    const budgetFallbacks = allowBudgetFallback
      ? await this.prisma.budget.findMany({
          where: {
            year,
            kind: BudgetKind.BUDGET,
            status: BudgetStatus.READY,
          },
          orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
          select: { id: true, kind: true, isActive: true, updatedAt: true },
        })
      : [];

    const prioritized = [...actualBudgets, ...budgetFallbacks];
    if (prioritized.length === 0) return new Array(12).fill(0);

    for (const budget of prioritized) {
      const grouped = await this.prisma.dreLine.groupBy({
        by: ['month'],
        where: {
          budgetId: budget.id,
          mode: 'REALIZADO',
          accountCode: { in: accountCodes },
        },
        _sum: { value: true },
      });

      const series = new Array(12).fill(0);
      grouped.forEach((item) => {
        if (item.month >= 1 && item.month <= 12) {
          series[item.month - 1] = this.toNumber(item._sum.value);
        }
      });
      const total = series.reduce((acc, value) => acc + this.toNumber(value), 0);
      if (grouped.length > 0 || Math.abs(total) > 0.01) {
        return series;
      }
    }

    return new Array(12).fill(0);
  }
}
