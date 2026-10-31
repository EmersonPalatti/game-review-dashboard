const integerFormat = new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 0,
});

const percentFormat = new Intl.NumberFormat('pt-BR', {
  style: 'percent',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const hoursFormat = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const dateFormat = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
});

const languageLabels: Record<string, string> = {
  english: 'Inglês',
  schinese: 'Chinês simplificado',
  tchinese: 'Chinês tradicional',
  russian: 'Russo',
  brazilian: 'Português brasileiro',
  portuguese: 'Português',
  spanish: 'Espanhol',
  latam: 'Espanhol (América Latina)',
  german: 'Alemão',
  french: 'Francês',
  polish: 'Polonês',
  turkish: 'Turco',
  koreana: 'Coreano',
  japanese: 'Japonês',
  italian: 'Italiano',
  thai: 'Tailandês',
  czech: 'Tcheco',
  swedish: 'Sueco',
  hungarian: 'Húngaro',
  dutch: 'Holandês',
  danish: 'Dinamarquês',
  finnish: 'Finlandês',
  norwegian: 'Norueguês',
  romanian: 'Romeno',
  ukrainian: 'Ucraniano',
  greek: 'Grego',
  bulgarian: 'Búlgaro',
  vietnamese: 'Vietnamita',
  arabic: 'Árabe',
};

export function formatInteger(value: number): string {
  return integerFormat.format(value);
}

export function formatPercent(value: number): string {
  return percentFormat.format(value);
}

export function formatHours(value: number): string {
  return hoursFormat.format(value);
}

export function formatDate(iso: string): string {
  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) {
    return iso.slice(0, 10);
  }
  return dateFormat.format(new Date(timestamp));
}

export function languageLabel(code: string): string {
  return languageLabels[code] ?? code;
}
