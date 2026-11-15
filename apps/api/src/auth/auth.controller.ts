import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { AuthLoginDto, AuthResponseDto, AuthVerifyDto } from "@projectx/models";

import { AuthService } from "./auth.service";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  /**
   * Endpoint to initiate the login process by sending a verification email.
   * @param body AuthLoginDto containing the user's email.
   * @returns A message indicating the email was sent.
   */
  @ApiOperation({
    summary: "Login with email",
    description: "This endpoint allow a user to login with email",
  })
  @ApiCreatedResponse({
    description: "The email for login was sent successfully",
  })
  @ApiBadRequestResponse({
    description: "There was an error sending the email",
  })
  @Post("login")
  @HttpCode(HttpStatus.CREATED)
  login(@Body() body: AuthLoginDto) {
    return this.authService.login(body);
  }

  /**
   * Endpoint to verify the login code and authenticate the user.
   * @param body AuthVerifyDto containing the user's email and verification code.
   * @returns AuthResponseDto containing the access token and user information.
   */
  @ApiOperation({
    summary: "Verify login code",
    description: "This endpoint allow a user to verify the login code",
  })
  @ApiOkResponse({
    description: "The user was verified successfully",
    type: AuthResponseDto,
  })
  @ApiBadRequestResponse({
    description: "There was an error verifying the user",
  })
  @Post("verify-code")
  @HttpCode(HttpStatus.OK)
  verify(@Body() body: AuthVerifyDto) {
    return this.authService.verifyLoginCode(body);
  }
}
