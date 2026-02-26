import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AdminUsersController } from './admin-users.controller';
import { AdminImportController } from '../admin/admin-import.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [UsersController, AdminUsersController, AdminImportController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
