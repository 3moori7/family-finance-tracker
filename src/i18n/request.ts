import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale } from "./locale";

export default getRequestConfig(async () => {
  const store = await cookies();
  const cookie = store.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(cookie) ? cookie : DEFAULT_LOCALE;
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
