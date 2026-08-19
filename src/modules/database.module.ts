import { Module } from '@nestjs/common';
import { DatabaseBootstrapService } from '../services/database-bootstrap.service';
import { DatabaseSeedService } from '../services/database-seed.service';

@Module({
  providers: [DatabaseBootstrapService, DatabaseSeedService],
})
export class DatabaseModule {}
