import * as xlsx from 'xlsx';

export interface AccountHierarchyNode {
  classification: string;
  description: string;
  level: number;
  children: AccountHierarchyNode[];
}

export interface AccountHierarchyParseResult {
  tree: AccountHierarchyNode[];
  errors: string[];
}

function normalizeHeader(value: unknown) {
  return String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '');
}

function normalizeClassification(value: unknown) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const cleaned = raw.replace(/[^\d.]/g, '').replace(/\.{2,}/g, '.').replace(/\.$/, '');
  return cleaned;
}

function findHeaderRow(rows: unknown[][]) {
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i] || [];
    let classificationIndex = -1;
    let descriptionIndex = -1;
    row.forEach((cell, idx) => {
      const normalized = normalizeHeader(cell);
      if (normalized === 'classificacao') classificationIndex = idx;
      if (normalized === 'descricao' || normalized === 'descrica') descriptionIndex = idx;
    });
    if (classificationIndex >= 0 && descriptionIndex >= 0) {
      return { rowIndex: i, classificationIndex, descriptionIndex };
    }
  }
  return null;
}

export function parseAccountHierarchyXlsx(buffer: Buffer, fileName: string): AccountHierarchyParseResult {
  const workbook = xlsx.read(buffer, { type: 'buffer' });
  const errors: string[] = [];
  const nodesByClassification = new Map<string, AccountHierarchyNode>();

  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return;
    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][];
    const header = findHeaderRow(rows);
    if (!header) return;

    for (let index = header.rowIndex + 1; index < rows.length; index += 1) {
      const row = rows[index] || [];
      const classificationRaw = row[header.classificationIndex];
      const descriptionRaw = row[header.descriptionIndex];

      const classification = normalizeClassification(classificationRaw);
      const description = String(descriptionRaw ?? '').trim();

      if (!classification || !description) {
        continue;
      }

      if (!/^\d/.test(classification)) {
        continue;
      }

      const segments = classification.split('.').filter(Boolean);
      const normalized = segments.join('.');
      const level = segments.length;

      if (!normalized) {
        continue;
      }

      const existing = nodesByClassification.get(normalized);
      if (existing) {
        if (!existing.description && description) {
          existing.description = description;
        }
        continue;
      }

      nodesByClassification.set(normalized, {
        classification: normalized,
        description,
        level,
        children: [],
      });
    }
  });

  if (nodesByClassification.size === 0) {
    errors.push(`${fileName} :: nenhuma hierarquia encontrada`);
    return { tree: [], errors };
  }

  const tree: AccountHierarchyNode[] = [];
  nodesByClassification.forEach((node) => {
    const segments = node.classification.split('.').filter(Boolean);
    const parentKey = segments.slice(0, -1).join('.');
    const parent = parentKey ? nodesByClassification.get(parentKey) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      tree.push(node);
    }
  });

  const sortNodes = (items: AccountHierarchyNode[]) => {
    items.sort((a, b) => a.classification.localeCompare(b.classification));
    items.forEach((child) => sortNodes(child.children));
  };
  sortNodes(tree);

  return { tree, errors };
}
