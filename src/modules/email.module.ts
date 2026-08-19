import { Global, Module } from '@nestjs/common';
import { EmailService } from '../common/email.service';

@Global()
@Module({
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
