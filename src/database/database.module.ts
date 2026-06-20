import { Module } from '@nestjs/common';
import { DatabaseBootstrapService } from './database-bootstrap.service';

@Module({
  providers: [DatabaseBootstrapService],
})
export class DatabaseModule {}
