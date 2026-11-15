import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  type CreateUserDto,
  type UpdateUserDto,
  UserDto,
  UserStatus,
} from "@projectx/models";
import { plainToInstance } from "class-transformer";

import { PrismaService } from "../prisma.service";
import { DEFAULT_ROLES, DEFAULT_USER_ROLE } from "../roles";

const defaultRole = DEFAULT_ROLES.find(
  (role) => role.name === DEFAULT_USER_ROLE,
);

@Injectable()
export class UserRepositoryService {
  private logger = new Logger(UserRepositoryService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findAll(): Promise<UserDto[]> {
    this.logger.verbose("findAll()");
    const users = await this.prisma.user.findMany({ orderBy: { id: "asc" } });
    return users.map((user) =>
      plainToInstance(UserDto, user, { excludeExtraneousValues: true }),
    );
  }

  /**
   * Create a user with the default role (`user`). The role is created if the
   * database was not seeded yet.
   */
  async createUser(data: CreateUserDto): Promise<UserDto> {
    this.logger.verbose(`createUser(${data.email})`);
    const user = await this.prisma.user.create({
      data: {
        ...data,
        roles: {
          create: {
            role: {
              connectOrCreate: {
                where: { name: DEFAULT_USER_ROLE },
                create: {
                  name: DEFAULT_USER_ROLE,
                  description: defaultRole?.description,
                },
              },
            },
          },
        },
      },
    });
    return plainToInstance(UserDto, user, {
      excludeExtraneousValues: true,
    });
  }

  /** The account behind a token, only while it is active (else null) */
  async findActiveById(
    id: number,
  ): Promise<{ id: number; email: string; username: string | null } | null> {
    return this.prisma.user.findFirst({
      where: { id, status: "Active" },
      select: { id: true, email: true, username: true },
    });
  }

  async findOneByEmail(email: string): Promise<UserDto | null> {
    this.logger.verbose(`findOneByEmail(${email})`);
    const user = await this.prisma.user.findUnique({
      where: { email },
    });
    if (!user) {
      return null;
    }
    return plainToInstance(UserDto, user, {
      excludeExtraneousValues: true,
    });
  }

  /**
   * Names of the roles assigned to a user, read on every authorized request so
   * a revoked role takes effect immediately. Empty when the user doesn't exist.
   */
  async findRoles(userId: number): Promise<string[]> {
    this.logger.verbose(`findRoles(${userId})`);
    // Only an active account has roles: suspending or deleting a user
    // revokes its access at the next request
    const roles = await this.prisma.role.findMany({
      where: { userRoles: { some: { userId, user: { status: "Active" } } } },
      select: { name: true },
      orderBy: { name: "asc" },
    });
    return roles.map((role) => role.name);
  }

  async updateUser(userId: number, data: UpdateUserDto): Promise<UserDto> {
    this.logger.verbose(`updateUser(${userId})`);
    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
    });
    return plainToInstance(UserDto, user, {
      excludeExtraneousValues: true,
    });
  }

  async getOrCreate(email: string) {
    let user = await this.findOneByEmail(email);
    if (!user) {
      const newUser: CreateUserDto = {
        email,
        status: UserStatus.Active,
      };
      user = await this.createUser(newUser);
    }
    return user;
  }
}
