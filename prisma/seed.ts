import { Prisma, PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';
import { parseAccountPlanXlsx, importAccountPlanRows } from '../src/account-plans/account-plans.importer';
import { dreData } from '../frontend/src/data/dre-data';
import { importPlanningXlsx } from '../src/planning/planning.importer';
import * as xlsx from 'xlsx';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('ChangeMe123!', 10);
  const defaultCoordinatorPasswordHash = await bcrypt.hash('123456', 10);

  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      name: 'Admin',
      username: 'admin',
      email: 'admin@printbag.local',
      role: Role.ADMIN,
      passwordHash,
      active: true,
    },
  });

  const controller = await prisma.user.upsert({
    where: { username: 'controller' },
    update: {},
    create: {
      name: 'Controller',
      username: 'controller',
      email: 'controller@printbag.local',
      role: Role.CONTROLLER,
      passwordHash,
      active: true,
    },
  });

  const coordinator = await prisma.user.upsert({
    where: { username: 'coordinator' },
    update: {},
    create: {
      name: 'Coordinator',
      username: 'coordinator',
      email: 'coordinator@printbag.local',
      role: Role.COORDINATOR,
      passwordHash,
      active: true,
    },
  });

  const coordinatorSeeds = [
    { name: 'Cristiane', username: 'cristiane' },
    { name: 'Carlos', username: 'carlos' },
    { name: 'Felipe Reis', username: 'felipe.reis' },
    { name: 'Dijael', username: 'dijael' },
    { name: 'Felipe Zaleski', username: 'felipe.zaleski' },
    { name: 'Anna Carini', username: 'anna.carini' },
    { name: 'Victor', username: 'victor' },
    { name: 'Juliana', username: 'juliana' },
    { name: 'Fabrizio', username: 'fabrizio' },
  ];

  for (const seed of coordinatorSeeds) {
    await prisma.user.upsert({
      where: { username: seed.username },
      update: {
        name: seed.name,
        role: Role.COORDINATOR,
        active: true,
        mustChangePassword: true,
        passwordHash: defaultCoordinatorPasswordHash,
      },
      create: {
        name: seed.name,
        username: seed.username,
        email: `${seed.username}@coordenador.local`,
        role: Role.COORDINATOR,
        passwordHash: defaultCoordinatorPasswordHash,
        mustChangePassword: true,
        active: true,
      },
    });
  }

  await prisma.costCenter.upsert({
    where: { code: 'CC-LOG' },
    update: {},
    create: {
      code: 'CC-LOG',
      name: 'Logistica',
      ownerCoordinatorId: coordinator.id,
      active: true,
    },
  });

  await prisma.costCenter.upsert({
    where: { code: 'CC-MKT' },
    update: {},
    create: {
      code: 'CC-MKT',
      name: 'Marketing',
      ownerCoordinatorId: coordinator.id,
      active: true,
    },
  });

  await prisma.account.upsert({
    where: { code: '13.03' },
    update: {},
    create: { code: '13.03', name: 'Plano de saude', category: 'Beneficios', active: true },
  });

  await prisma.account.upsert({
    where: { code: '22.01' },
    update: {},
    create: { code: '22.01', name: 'Servicos terceirizados', category: 'Servicos', active: true },
  });

  await prisma.account.upsert({
    where: { code: '40.10' },
    update: {},
    create: { code: '40.10', name: 'Consumo operacional', category: 'Operacional', active: true },
  });

  await prisma.scenario.upsert({
    where: { id: '11111111-1111-1111-1111-111111111111' },
    update: {},
    create: {
      id: '11111111-1111-1111-1111-111111111111',
      name: 'Orcamento 2026',
      year: 2026,
      createdById: admin.id,
    },
  });

  await prisma.scenario.upsert({
    where: { id: '22222222-2222-2222-2222-222222222222' },
    update: {},
    create: {
      id: '22222222-2222-2222-2222-222222222222',
      name: 'Orcamento 2025',
      year: 2025,
      createdById: admin.id,
    },
  });

  const existingBudgets = await prisma.budget.count();
  if (existingBudgets === 0) {
    const years = Object.keys(dreData);
    for (const yearKey of years) {
      const year = Number(yearKey);
      const budget = await prisma.budget.create({
        data: {
          name: `Orcamento ${year}`,
          year,
          kind: 'BUDGET',
          status: 'READY',
          isActive: year === 2026,
          version: 1,
          fileName: `dre-${year}.xlsx`,
        },
      });

      await prisma.budgetImport.create({
        data: {
          budgetId: budget.id,
          version: 1,
          fileName: `dre-${year}.xlsx`,
          status: 'READY',
        },
      });

      const raw = (dreData as any)[yearKey];
      const columns = raw.columns as Array<{ label: string; kind: string }>;
      const monthColumns = columns
        .map((col, index) => {
          if (col.label === 'Total') return null;
          const [month, colYear] = col.label.split('/');
          if (!month || !colYear) return null;
          return { index, month: Number(month), kind: col.kind };
        })
        .filter(Boolean) as Array<{ index: number; month: number; kind: string }>;

      const rows = raw.rows as Array<{ label: string; level?: number; values?: number[] }>;
      const stack: Array<{ level: number; key: string }> = [];
      const lines: Prisma.DreLineCreateManyInput[] = [];

      rows.forEach((row, rowIndex) => {
        const label = String(row.label ?? '').replace(/\s+/g, ' ').trim();
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

        monthColumns.forEach((col) => {
          const value = Number(row.values?.[col.index] ?? 0);
          const mode = col.kind.toLowerCase().includes('real') ? 'REALIZADO' : 'PREVISTO';
          lines.push({
            budgetId: budget.id,
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
          });
        });
      });

      if (lines.length > 0) {
        await prisma.dreLine.createMany({ data: lines });
      }
    }
  }

  const accountPlanCount = await prisma.accountPlan.count();
  if (accountPlanCount === 0) {
    const filePath = path.resolve(__dirname, '..', 'data', 'plano_contas.xlsx');
    if (fs.existsSync(filePath)) {
      const buffer = fs.readFileSync(filePath);
      const { rows, errors } = parseAccountPlanXlsx(buffer);
      const summary = await importAccountPlanRows(prisma, rows, errors);
      console.log('Account plan import completed', summary);
    } else {
      console.warn(`Account plan seed skipped. File not found at ${filePath}`);
    }
  }

  const planningFilePath = path.resolve(__dirname, '..', 'conta de cada coordenador.xlsx');
  if (fs.existsSync(planningFilePath)) {
    const buffer = fs.readFileSync(planningFilePath);
    const result = await importPlanningXlsx(prisma, buffer, { defaultPassword: '123456', createdById: admin.id });
    console.log('Planning import completed', result);
  } else {
    console.warn(`Planning import skipped. File not found at ${planningFilePath}`);
  }

  const proacoes = await prisma.proacao.findMany();
  const yearsToSeed = [2025, 2026];
  for (const year of yearsToSeed) {
    for (const proacao of proacoes) {
      const existingLimit = await prisma.budgetLimit.findFirst({
        where: { year, proacaoId: proacao.id, userId: null },
      });
      if (!existingLimit) {
        await prisma.budgetLimit.create({
          data: { year, proacaoId: proacao.id, userId: null, maxValue: 0 },
        });
      }
    }

    for (let month = 1; month <= 12; month += 1) {
      await prisma.revenueProjection.upsert({
        where: { year_month: { year, month } },
        update: {},
        create: { year, month, value: 0 },
      });
    }
  }

  const baselineFile = path.resolve(__dirname, '..', 'dre 2026 - orçado.xlsx');
  if (fs.existsSync(baselineFile)) {
    const normalizeLabel = (value: string) =>
      value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();

    const workbook = xlsx.readFile(baselineFile);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: true }) as Array<Array<any>>;
    const header = rows[0] ?? [];
    const monthColumns = header
      .map((label: string, index: number) => {
        const text = String(label ?? '');
        if (!text) return null;
        if (!text.toLowerCase().includes('previsto')) return null;
        const match = text.match(/(\d{2})\/(\d{4})/);
        if (!match) return null;
        return { index, month: Number(match[1]), year: Number(match[2]) };
      })
      .filter(Boolean) as Array<{ index: number; month: number; year: number }>;

    for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex] ?? [];
      const rawLabel = String(row[0] ?? '').replace(/\s+/g, ' ').trim();
      if (!rawLabel) continue;
      const match = rawLabel.match(/^(\d+(?:\.\d+)*)\s*-\s*(.+)$/);
      const accountCode = match?.[1] ?? normalizeLabel(rawLabel);
      const accountLabel = match?.[2]?.trim() ?? rawLabel;

      for (const col of monthColumns) {
        if (col.year !== 2026) continue;
        const value = Number(row[col.index] ?? 0) || 0;
        await prisma.dreBudgetBaseline.upsert({
          where: { year_accountCode_month: { year: 2026, accountCode, month: col.month } },
          update: { value, accountLabel, sourceFile: path.basename(baselineFile) },
          create: { year: 2026, accountCode, accountLabel, month: col.month, value, sourceFile: path.basename(baselineFile) },
        });
      }
    }
  } else {
    console.warn(`DRE baseline seed skipped. File not found at ${baselineFile}`);
  }

  console.log('Seed completed', { admin, controller, coordinator });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
