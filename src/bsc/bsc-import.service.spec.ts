import { BscImportStatus } from '@prisma/client';
import { BscImportService } from './bsc-import.service';

describe('BscImportService', () => {
  it('returns reused result when file hash was already imported', async () => {
    const prismaMock = {
      bscImport: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'imp-1',
          status: BscImportStatus.SUCCESS,
          warnings: [{ sheetName: 'MAPA', rowIndex: 1, message: 'x' }],
          counters: { indicatorsCreated: 10 },
        }),
      },
    };
    const service = new BscImportService(prismaMock as any);
    const result = await service.importExcel(
      {
        originalname: 'easy360 - Projeto Printbag - Mapa Estrategico 2025.xlsx',
        buffer: Buffer.from('abc'),
      } as Express.Multer.File,
      'user-1',
    );

    expect(prismaMock.bscImport.findFirst).toHaveBeenCalled();
    expect(result).toEqual({
      importId: 'imp-1',
      status: BscImportStatus.SUCCESS,
      reused: true,
      warningsCount: 1,
      counters: { indicatorsCreated: 10 },
    });
  });
});

