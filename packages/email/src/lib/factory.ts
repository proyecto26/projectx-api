import { getLoginEmailHtml, type LoginEmailData } from "./auth/login";
import { EmailTemplates } from "./template";

export type EmailTemplateDataMap = {
  [EmailTemplates.AuthLogin]: LoginEmailData;
};

export function createEmailTemplate<T extends EmailTemplates>(
  templateKey: T,
  data: EmailTemplateDataMap[T],
) {
  switch (templateKey) {
    case EmailTemplates.AuthLogin:
      return getLoginEmailHtml(data);
    default:
      return null;
  }
}
