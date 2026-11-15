import { Module } from "@nestjs/common";
import { UserSchemaModule } from "@projectx/db";

import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

@Module({
  // UserSchemaModule also provides the UserRepositoryService used by RolesGuard
  imports: [UserSchemaModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
