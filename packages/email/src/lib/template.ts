import { createEmailTemplate, type EmailTemplateDataMap } from "./factory";

export enum EmailTemplates {
  AuthLogin = "auth_login",
}

export function getEmailTemplate<T extends EmailTemplates>(
  templateKey: T,
  data: EmailTemplateDataMap[T],
) {
  return createEmailTemplate(templateKey, data);
}
