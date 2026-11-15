import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Patch,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import {
  AuthenticatedUser,
  type AuthUser,
  JwtAuthGuard,
  Roles,
  RolesGuard,
} from "@projectx/core";
import { RoleName, UpdateUserDto, UserDto } from "@projectx/models";

import { UsersService } from "./users.service";

/**
 * `JwtAuthGuard` accepts a token only while its account exists and is active
 * (checked on every request), and `RolesGuard` checks `@Roles(...)`.
 */
@ApiBearerAuth()
@ApiTags("Users")
@ApiUnauthorizedResponse({
  description: "Missing or invalid token, or the account is not active",
})
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({ summary: "Get the profile of the signed-in user" })
  @ApiOkResponse({ description: "The profile", type: UserDto })
  @Get("me")
  @HttpCode(HttpStatus.OK)
  async getProfile(@AuthenticatedUser() authUser: AuthUser) {
    const user = await this.usersService.findOne(authUser);
    if (!user) {
      throw new NotFoundException("User not found");
    }
    return user;
  }

  @ApiOperation({ summary: "Update the profile of the signed-in user" })
  @ApiOkResponse({ description: "The updated profile", type: UserDto })
  @Patch("me")
  @HttpCode(HttpStatus.OK)
  updateProfile(
    @AuthenticatedUser() authUser: AuthUser,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.updateProfile(authUser.id, updateUserDto);
  }

  @ApiOperation({ summary: "List users", description: "Only for admins" })
  @ApiOkResponse({ description: "The users", type: [UserDto] })
  @ApiForbiddenResponse({ description: "The user is not an admin" })
  @Roles(RoleName.Admin)
  @Get()
  @HttpCode(HttpStatus.OK)
  findAll() {
    return this.usersService.findAll();
  }
}
