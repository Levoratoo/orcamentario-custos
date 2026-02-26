import { Module } from '@nestjs/common';
import { AccountPlansController } from './account-plans.controller';
import { AccountPlansService } from './account-plans.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AccountPlansController],
  providers: [AccountPlansService],
})
export class AccountPlansModule {}
