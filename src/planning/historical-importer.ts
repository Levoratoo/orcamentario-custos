import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';
import * as xlsx from 'xlsx';

type CatalogEntry = {
  proacao: string;
  code: string;
  label: string;
  padrinho: string;
  orderIndex: number;
};

type ImportSummary = {
  catalog: {
    proacoes: number;
    accounts: number;
    assignments: number;
  };
  valuesByYear: Record<
    number,
    {
      file: string;
      cells: number;
      totalAnnual: number;
      totalsByMonth: Record<number, number>;
    }
  >;
};

function normalizeKey(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s.]/g, '')
    .trim()
    .replace(/\s+/g, '.');
}

function parseAccountCode(label: string) {
  const match = label.match(/^(\d+(?:\.\d+)*)\s*-\s*(.+)$/);
  return match?.[1] ?? '';
}

function parseAccountName(label: string) {
  const match = label.match(/^[\d.]+\s*-\s*(.+)$/);
  return (match?.[1] ?? label).trim();
}

function parseDecimal(value: unknown) {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  const text = String(value)
    .replace('R$', '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : 0;
}

function resolveHistoricalFiles(root: string) {
  const files = fs.readdirSync(root);
  const targets: Array<{ year: number; file: string }> = [];
  for (const year of [2020, 2021, 2022, 2023]) {
    const found = files.find((name) => {
      const normalized = normalizeKey(name);
      return normalized.includes(`proacao${year}`) || normalized.includes(`proa${year}`);
    });
    if (found) {
      targets.push({ year, file: path.join(root, found) });
    }
  }
  return targets;
}

function parseAccountCatalog(filePath: string) {
  const workbook = xlsx.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' });
  const entries: CatalogEntry[] = [];
  rows.forEach((row, index) => {
    const normalized: Record<string, string> = {};
    Object.keys(row).forEach((key) => {
      normalized[normalizeKey(key)] = String(row[key] ?? '').trim();
    });
    const proacao = normalized['proacao'];
    const code = normalized['cod'] || normalized['codigo'] || normalized['cod.'];
    const label = normalized['contas'] || normalized['conta'] || normalized['setor'];
    const padrinho = normalized['padrinho'] || normalized['coordenador'] || normalized['responsavel'];
    if (!proacao || !code || !label || !padrinho) return;
    entries.push({ proacao, code: String(code), label, padrinho, orderIndex: index });
  });
  return entries;
}

async function ensureCoordinator(prisma: PrismaService, name: string, passwordHash: string) {
  const username = slugify(name);
  const existing = await prisma.user.findFirst({ where: { OR: [{ username }, { name }] } });
  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: { name, role: Role.COORDINATOR, active: true },
    });
  }
  return prisma.user.create({
    data: {
      name,
      username,
      email: `${username}@coordenador.local`,
      role: Role.COORDINATOR,
      passwordHash,
      mustChangePassword: true,
      active: true,
    },
  });
}

export async function importHistoricalPlanning(prisma: PrismaService, rootDir: string) {
  const catalogFile = path.join(rootDir, 'conta de cada coordenador.xlsx');
  if (!fs.existsSync(catalogFile)) {
    throw new Error(`Catalogo nao encontrado: ${catalogFile}`);
  }

  const passwordHash = await bcrypt.hash('123456', 10);
  const admin = await prisma.user.findFirst({ where: { username: 'admin' } });
  if (!admin) throw new Error('Admin user nao encontrado');

  const catalog = parseAccountCatalog(catalogFile);
  const catalogByCode = new Map<string, CatalogEntry>();
  catalog.forEach((entry) => catalogByCode.set(entry.code, entry));

  let assignmentsCount = 0;
  let accountCount = 0;
  const proacaoNames = new Set<string>();

  await ensureCoordinator(prisma, 'Importado', passwordHash);
  await prisma.proacao.upsert({
    where: { name: 'Importado' },
    update: {},
    create: { name: 'Importado' },
  });

  for (const entry of catalog) {
    const coordinator = await ensureCoordinator(prisma, entry.padrinho, passwordHash);
    const proacao = await prisma.proacao.upsert({
      where: { name: entry.proacao },
      update: {},
      create: { name: entry.proacao },
    });
    proacaoNames.add(proacao.name);

    const existing = await prisma.planningAccount.findUnique({
      where: {
        proacaoId_code_ownerUserId: {
          proacaoId: proacao.id,
          code: String(entry.code),
          ownerUserId: coordinator.id,
        },
      },
    });

    let accountId: string;
    if (existing) {
      await prisma.planningAccount.update({
        where: { id: existing.id },
        data: {
          label: entry.label,
          name: parseAccountName(entry.label),
          orderIndex: entry.orderIndex,
        },
      });
      accountId = existing.id;
    } else {
      const created = await prisma.planningAccount.create({
        data: {
          proacaoId: proacao.id,
          code: String(entry.code),
          label: entry.label,
          name: parseAccountName(entry.label),
          ownerUserId: coordinator.id,
          orderIndex: entry.orderIndex,
        },
      });
      accountId = created.id;
      accountCount += 1;
    }

    await prisma.userAccountAssignment.upsert({
      where: { userId_accountId: { userId: coordinator.id, accountId } },
      update: {},
      create: { userId: coordinator.id, accountId, createdById: admin.id },
    });
    assignmentsCount += 1;
  }

  const valuesByYear: ImportSummary['valuesByYear'] = {};
  const files = resolveHistoricalFiles(rootDir);
  for (const item of files) {
    const year = item.year;
    const workbook = xlsx.readFile(item.file);
    let totalCells = 0;
    const totalsByMonth: Record<number, number> = {};

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: true }) as Array<Array<unknown>>;
      if (rows.length === 0) continue;
      const header = rows[0].map((value) => String(value ?? ''));
      const headerMap: Record<string, number> = {};
      header.forEach((value, index) => {
        headerMap[normalizeKey(value)] = index;
      });

      const codeIndex = headerMap['cod'] ?? headerMap['codigo'] ?? -1;
      const labelIndex = headerMap['contacontabil'] ?? 0;
      const monthColumns = header
        .map((value, index) => {
          const text = String(value ?? '');
          if (!text.toLowerCase().includes('previsto')) return null;
          const match = text.match(/(\d{2})\/(\d{4})/);
          if (!match) return null;
          const month = Number(match[1]);
          const colYear = Number(match[2]);
          if (colYear !== year) return null;
          return { index, month };
        })
        .filter(Boolean) as Array<{ index: number; month: number }>;

      for (let i = 1; i < rows.length; i += 1) {
        const row = rows[i] ?? [];
        const rawLabel = String(row[labelIndex] ?? '').trim();
        if (!rawLabel) continue;
        const code = codeIndex >= 0 ? String(row[codeIndex] ?? '').trim() : parseAccountCode(rawLabel);
        const accountCode = code || parseAccountCode(rawLabel);
        if (!accountCode) continue;

        const catalogEntry = catalogByCode.get(accountCode);
        const proacaoName = catalogEntry?.proacao ?? 'Importado';
        const padrinhoName = catalogEntry?.padrinho ?? 'Importado';
        const label = catalogEntry?.label ?? rawLabel;
        const orderIndex = catalogEntry?.orderIndex ?? i;

        const coordinator = await ensureCoordinator(prisma, padrinhoName, passwordHash);
        const proacao = await prisma.proacao.upsert({
          where: { name: proacaoName },
          update: {},
          create: { name: proacaoName },
        });
        proacaoNames.add(proacao.name);

        const existing = await prisma.planningAccount.findUnique({
          where: {
            proacaoId_code_ownerUserId: {
              proacaoId: proacao.id,
              code: accountCode,
              ownerUserId: coordinator.id,
            },
          },
        });

        let accountId: string;
        if (existing) {
          await prisma.planningAccount.update({
            where: { id: existing.id },
            data: { label, name: parseAccountName(label), orderIndex },
          });
          accountId = existing.id;
        } else {
          const created = await prisma.planningAccount.create({
            data: {
              proacaoId: proacao.id,
              code: accountCode,
              label,
              name: parseAccountName(label),
              ownerUserId: coordinator.id,
              orderIndex,
            },
          });
          accountId = created.id;
          accountCount += 1;
        }

        await prisma.userAccountAssignment.upsert({
          where: { userId_accountId: { userId: coordinator.id, accountId } },
          update: {},
          create: { userId: coordinator.id, accountId, createdById: admin.id },
        });
        assignmentsCount += 1;

        for (const col of monthColumns) {
          const value = parseDecimal(row[col.index]);
          totalsByMonth[col.month] = (totalsByMonth[col.month] ?? 0) + value;
          totalCells += 1;
          await prisma.planningValue.upsert({
            where: { accountId_year_month: { accountId, year, month: col.month } },
            update: {
              value,
              source: 'IMPORT',
              sourceFile: path.basename(item.file),
              locked: true,
              updatedById: admin.id,
            },
            create: {
              accountId,
              year,
              month: col.month,
              value,
              source: 'IMPORT',
              sourceFile: path.basename(item.file),
              locked: true,
              updatedById: admin.id,
            },
          });
        }
      }
    }

    const totalAnnual = Object.values(totalsByMonth).reduce((sum, value) => sum + value, 0);
    valuesByYear[year] = {
      file: path.basename(item.file),
      cells: totalCells,
      totalAnnual,
      totalsByMonth,
    };
  }

  return {
    catalog: {
      proacoes: proacaoNames.size,
      accounts: accountCount,
      assignments: assignmentsCount,
    },
    valuesByYear,
  };
}
