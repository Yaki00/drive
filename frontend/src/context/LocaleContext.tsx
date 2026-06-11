import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  formatMessage,
  getDateLocale,
  translations,
  type Locale,
  type TranslationKey,
} from '../i18n/translations';

const STORAGE_KEY = 'bookmarks-locale';

interface LocaleContextValue {
  locale: Locale;
  dateLocale: string;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  toggleLocale: () => void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

function getInitialLocale(): Locale {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === 'fr' ? 'fr' : 'en';
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(() => {
    const initial = getInitialLocale();
    document.documentElement.lang = initial;
    return initial;
  });

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>) =>
      formatMessage(translations[locale][key], params),
    [locale],
  );

  const toggleLocale = useCallback(() => {
    setLocale((prev) => {
      const next: Locale = prev === 'en' ? 'fr' : 'en';
      localStorage.setItem(STORAGE_KEY, next);
      document.documentElement.lang = next;
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      locale,
      dateLocale: getDateLocale(locale),
      t,
      toggleLocale,
    }),
    [locale, t, toggleLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider');
  return ctx;
}
