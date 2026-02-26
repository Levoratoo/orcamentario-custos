import { PrismaClient } from '@prisma/client';
import { importRealizadoBaseline2026, resolveRealizadoBaselineFile } from '../src/dre/realized-baseline.importer';

const prisma = new PrismaClient();

async function main() {
  const filePath = resolveRealizadoBaselineFile();
  if (!filePath) {
    throw new Error('Arquivo baseline nao encontrado');
  }
  const summary = await importRealizadoBaseline2026(prisma, filePath);
  // eslint-disable-next-line no-console
  console.log('Import realizado 2026', summary);
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
