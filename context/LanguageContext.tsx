'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Lang, getT } from '@/lib/translations';

type LanguageContextType = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: ReturnType<typeof getT>;
  isRTL: boolean;
};

const LanguageContext = createContext<LanguageContextType>({
  lang: 'en',
  setLang: () => {},
  t: getT('en'),
  isRTL: false,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    const saved = localStorage.getItem('lang') as Lang | null;
    if (saved === 'ar' || saved === 'en') {
      applyLang(saved);
      setLangState(saved);
    }
  }, []);

  function applyLang(l: Lang) {
    document.documentElement.lang = l;
    document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr';
  }

  function setLang(l: Lang) {
    applyLang(l);
    localStorage.setItem('lang', l);
    setLangState(l);
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t: getT(lang), isRTL: lang === 'ar' }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
