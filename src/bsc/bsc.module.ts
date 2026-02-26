import { Module } from '@nestjs/common';
import { BscController } from './bsc.controller';
import { BscImportService } from './bsc-import.service';
import { BscService } from './bsc.service';

@Module({
  controllers: [BscController],
  providers: [BscImportService, BscService],
})
export class BscModule {}

