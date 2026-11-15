import { Module } from "@nestjs/common";
import { UserSchemaModule } from "./user";

const providers = [UserSchemaModule];

@Module({
  imports: providers,
  exports: providers,
})
export class DbModule {}
