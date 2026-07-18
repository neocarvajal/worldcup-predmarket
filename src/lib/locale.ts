/**
 * Notification translation dictionary (EN/ES)
 * ============================================
 * Minimal i18n for push and in-app notification strings. `detectLocale` reads
 * navigator.language on the client; server-side defaults to Spanish. `t()` maps
 * keys like `you_won`, `match_finished` to the correct locale string.
 */

export type Locale = 'en' | 'es';

const dict: Record<string, { en: string; es: string }> = {
  match_finished: { en: '\uD83C\uDFC1 Match Finished', es: '\uD83C\uDFC1 Partido Finalizado' },
  match_started: { en: '\u26BD Match Started', es: '\u26BD Partido Iniciado' },
  you_won: { en: '\uD83C\uDFC6 You Won!', es: '\uD83C\uDFC6 \u00a1Ganaste!' },
  you_lost: { en: '\uD83D\uDE14 You Lost', es: '\uD83D\uDE14 Perdiste' },
  payment_sent: { en: 'Payment sent to your wallet', es: 'Pago enviado a tu wallet' },
  better_luck: { en: 'Better luck next time', es: 'Mejor suerte la pr\u00f3xima vez' },
};

export function detectLocale(): Locale {
  if (typeof navigator !== 'undefined') {
    return navigator.language?.startsWith('en') ? 'en' : 'es';
  }
  return 'es';
}

export function t(key: string, locale: Locale = 'es'): string {
  return dict[key]?.[locale] ?? key;
}
