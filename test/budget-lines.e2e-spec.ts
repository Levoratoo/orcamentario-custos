import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('BudgetLines', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates budget line as coordinator owner', async () => {
    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@printbag.local', password: 'ChangeMe123!' });

    const coordinatorLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'coordinator@printbag.local', password: 'ChangeMe123!' });

    const adminToken = adminLogin.body.accessToken;
    const coordinatorToken = coordinatorLogin.body.accessToken;

    const scenario = await request(app.getHttpServer())
      .post('/scenarios')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Teste 2026', year: 2026 });

    const costCenter = await request(app.getHttpServer())
      .post('/cost-centers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: 'CC-TST', name: 'Teste', ownerCoordinatorId: null });

    const coordinator = await prisma.user.findUnique({ where: { email: 'coordinator@printbag.local' } });

    await request(app.getHttpServer())
      .put(`/cost-centers/${costCenter.body.id}/owner`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ownerCoordinatorId: coordinator?.id });

    const account = await request(app.getHttpServer())
      .post('/accounts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: '99.99', name: 'Teste', category: 'Teste' });

    const budgetLine = await request(app.getHttpServer())
      .post('/budget-lines')
      .set('Authorization', `Bearer ${coordinatorToken}`)
      .send({
        scenarioId: scenario.body.id,
        costCenterId: costCenter.body.id,
        accountId: account.body.id,
        description: 'Linha teste',
        driverType: 'FIXED',
        driverValue: null,
        assumptions: 'Teste',
        monthlyValues: {
          '01': '100.00','02': '100.00','03': '100.00','04': '100.00',
          '05': '100.00','06': '100.00','07': '100.00','08': '100.00',
          '09': '100.00','10': '100.00','11': '100.00','12': '100.00'
        }
      })
      .expect(201);

    expect(budgetLine.body.id).toBeDefined();
  });
});
