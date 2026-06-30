"use client";

import { useLocale } from 'next-intl';
import { GlobeIcon } from '@radix-ui/react-icons';

function setCookie(name: string, value: string, days: number) {
  const expires = new Date(Date.now() + days * 86400000).toUTCString();
  document.cookie = `${name}=${value};path=/;expires=${expires};SameSite=Lax`;
}

const locales = [
  { code: 'en', label: 'EN' },
  { code: 'es', label: 'ES' },
];

export function LanguageToggle() {
  const locale = useLocale();

  const toggle = () => {
    const next = locale === 'en' ? 'es' : 'en';
    setCookie('NEXT_LOCALE', next, 365);
    window.location.reload();
  };

  return (
    <button
      onClick={toggle}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-bold transition-all duration-200 active:scale-95"
      style={{
        background: 'var(--bg-surface)',
        color: 'var(--text-muted)',
        border: '1px solid var(--border)',
      }}
      aria-label="Toggle language"
    >
      <GlobeIcon width={14} height={14} />
      {locale === 'en' ? 'ES' : 'EN'}
    </button>
  );
}
