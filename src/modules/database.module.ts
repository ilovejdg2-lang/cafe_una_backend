import { Module } from '@nestjs/common';
import { DatabaseBootstrapService } from '../services/database-bootstrap.service';

@Module({
  providers: [DatabaseBootstrapService],
})
export class DatabaseModule {}
