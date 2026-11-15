import { Environment } from "@projectx/models";
import {
  IsDefined,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";

export class EnvironmentVariables {
  @IsEnum(Environment)
  @IsDefined()
  NODE_ENV!: Environment;

  @IsInt()
  @Min(0)
  @Max(65535)
  @IsOptional()
  API_PORT?: number;

  @IsString()
  @IsNotEmpty()
  JWT_SECRET!: string;

  /** Empty in development prints emails to the logs, required elsewhere */
  @IsString()
  @IsOptional()
  SENDGRID_API_KEY?: string;

  @IsString()
  @IsOptional()
  TEMPORAL_TASK_QUEUE?: string;
}
