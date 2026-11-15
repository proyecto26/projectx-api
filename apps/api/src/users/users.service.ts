import { Inject, Injectable, Logger } from "@nestjs/common";
import type { AuthUser } from "@projectx/core";
import { UserRepositoryService } from "@projectx/db";
import type { UpdateUserDto } from "@projectx/models";

@Injectable()
export class UsersService {
  readonly logger = new Logger(UsersService.name);
  constructor(
    @Inject(UserRepositoryService)
    private readonly userRepository: UserRepositoryService,
  ) {}

  findOne(user: AuthUser) {
    this.logger.log(`findOne(${user.id})`, user);
    return this.userRepository.findOneByEmail(user.email);
  }

  findAll() {
    this.logger.log("findAll()");
    return this.userRepository.findAll();
  }

  getOrCreate(...params: Parameters<typeof this.userRepository.getOrCreate>) {
    return this.userRepository.getOrCreate(...params);
  }

  updateProfile(userId: number, data: UpdateUserDto) {
    this.logger.log(`updateProfile(${userId})`);
    return this.userRepository.updateUser(userId, data);
  }
}
