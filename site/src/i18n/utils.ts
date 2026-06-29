export const defaultLocale = "id";
export const locales = ["id", "en"] as const;
export type Locale = (typeof locales)[number];

export const localeLabels: Record<Locale, string> = {
  id: "Bahasa Indonesia",
  en: "English",
};

export const localeNames: Record<Locale, string> = {
  id: "ID",
  en: "EN",
};

export function getLocaleFromUrl(url: URL): Locale {
  const [, lang] = url.pathname.split("/");
  if (locales.includes(lang as Locale)) return lang as Locale;
  return defaultLocale;
}

export function getPathWithoutLocale(pathname: string): string {
  for (const loc of locales) {
    if (loc === defaultLocale) continue;
    if (pathname.startsWith(`/${loc}/`) || pathname === `/${loc}`) {
      return pathname.slice(`/${loc}`.length) || "/";
    }
  }
  return pathname;
}

export function localizedPath(path: string, locale: Locale): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  if (locale === defaultLocale) return clean;
  return `/${locale}${clean}`;
}

export function alternatePath(path: string, locale: Locale): string {
  return localizedPath(getPathWithoutLocale(path), locale);
}
