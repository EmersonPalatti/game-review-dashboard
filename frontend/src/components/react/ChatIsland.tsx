import {
  AlertCircle,
  Bot,
  Check,
  Copy,
  Database,
  Filter,
  Maximize2,
  MessageSquare,
  Minimize2,
  RotateCcw,
  Send,
  Sparkles,
  Square,
  Trash2,
  X,
} from 'lucide';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  sendChatMessage,
  type ChatHistoryItem,
} from '../../lib/api';
import { formatDate, formatInteger, languageLabel } from '../../lib/format';
import { useFilters, useLatestMetrics } from '../../lib/useNanostore';
import {
  PLAYTIME_LABELS,
  activeFilterCount,
  filters as filtersAtom,
  resetFilters,
  type Filters,
  type PlaytimeBucket,
} from '../../stores/filters';
import { RailIcon } from './RailIcon';

export type TeaserItem = {
  text: string;
  prompt: string;
};

export const TEASER_ITEMS: readonly TeaserItem[] = [
  {
    text: 'Sabia que reviews negativas recebem 2,8x mais votos úteis? Veja o porquê.',
    prompt: 'Por que as reviews negativas recebem mais votos úteis neste recorte?',
  },
  {
    text: 'A janela de reembolso de 2h da Valve muda tudo na aprovação. Quer ver os números?',
    prompt: 'O que acontece com a aprovação nas primeiras 2 horas (janela de reembolso)?',
  },
  {
    text: 'Jogos em Early Access perdem 14 p.p. de aprovação média. Consulte o impacto real.',
    prompt: 'Qual o impacto do Early Access na taxa de aprovação deste recorte?',
  },
  {
    text: 'Quem joga 500h+ e avalia negativamente? Posso puxar os casos mais extremos.',
    prompt: 'Mostre exemplos de reviews negativas de quem tem muitas horas jogadas neste recorte',
  },
  {
    text: '1.000.000 de reviews auditadas em SQL. Pergunte qualquer métrica do recorte atual.',
    prompt: 'Qual o resumo estatístico e taxa de aprovação do recorte atual?',
  },
];

export const TEASERS: readonly string[] = TEASER_ITEMS.map((item) => item.text);

export const SUGGESTED_QUESTIONS: readonly string[] = [
  'Qual o resumo e taxa de aprovação do recorte atual?',
  'O que acontece nas primeiras 2 horas (janela de reembolso)?',
  'Por que as reviews negativas recebem mais votos úteis?',
  'Mostre exemplos das reviews mais úteis deste recorte',
];

type MessageItem = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  tools_used?: string[];
  context_label?: string;
  isError?: boolean;
};

const WELCOME_MESSAGE: MessageItem = {
  id: 'welcome',
  role: 'assistant',
  content:
    'Sou o **SteamBot-9000**, co-piloto analítico deste estudo. Consulto diretamente o banco SQLite com **1.000.000 de avaliações** (de quem reembolsou aos 119 minutos a quem escreveu tese negativa após 2.000 horas de *Skyrim*).\n\nMinhas respostas usam automaticamente o **recorte filtrado ativo** no seu painel. Escolha uma investigação abaixo ou digite sua pergunta.',
};

const TOOL_LABELS: Record<string, string> = {
  get_metrics: 'KPIs & Rankings (/api/summary)',
  get_charts: 'Séries & Playtime (/api/charts)',
  get_reviews_sample: 'Amostra de Reviews (/api/reviews)',
};

type FilterAction = {
  id: string;
  label: string;
  isActive: (current: Filters) => boolean;
  apply: (current: Filters) => void;
};

const FALLBACK_TOP_GAMES: { app_id: number; app_name: string }[] = [
  { app_id: 107410, app_name: 'Arma 3' },
  { app_id: 489830, app_name: 'The Elder Scrolls V: Skyrim Special Edition' },
  { app_id: 304390, app_name: 'For Honor' },
  { app_id: 262060, app_name: 'Darkest Dungeon' },
  { app_id: 524220, app_name: 'NieR:Automata' },
  { app_id: 646570, app_name: 'Slay the Spire' },
  { app_id: 264710, app_name: 'Subnautica' },
  { app_id: 435150, app_name: 'Divinity: Original Sin 2' },
  { app_id: 367520, app_name: 'Hollow Knight' },
  { app_id: 504230, app_name: 'Celeste' },
];

function getShortGameName(name: string): string {
  if (name.includes('Skyrim')) return 'Skyrim';
  if (name.includes('Divinity')) return 'Divinity: OS 2';
  return name.length > 18 ? `${name.slice(0, 16)}...` : name;
}

export function extractFilterActions(
  content: string,
  games: { app_id: number; app_name: string }[],
): FilterAction[] {
  const actions: FilterAction[] = [];
  const lower = content.toLowerCase();
  const allGames = games.length > 0 ? games : FALLBACK_TOP_GAMES;

  // 1. Jogos mencionados
  for (const game of allGames) {
    const nameLower = game.app_name.toLowerCase();
    const shortName = getShortGameName(game.app_name);
    const mentions =
      lower.includes(nameLower) ||
      (nameLower.includes('skyrim') && lower.includes('skyrim')) ||
      (nameLower.includes('divinity') && lower.includes('divinity')) ||
      (nameLower.includes('nier') && lower.includes('nier')) ||
      (nameLower.includes('celeste') && lower.includes('celeste')) ||
      (nameLower.includes('hollow knight') && lower.includes('hollow knight')) ||
      (nameLower.includes('subnautica') && lower.includes('subnautica')) ||
      (nameLower.includes('arma 3') && lower.includes('arma 3')) ||
      (nameLower.includes('for honor') && lower.includes('for honor')) ||
      (nameLower.includes('darkest dungeon') && lower.includes('darkest dungeon')) ||
      (nameLower.includes('slay the spire') && lower.includes('slay the spire'));

    if (mentions) {
      const gId = game.app_id;
      actions.push({
        id: `game-${gId}`,
        label: `Jogo: ${shortName}`,
        isActive: (f) => f.appId === gId,
        apply: (f) =>
          filtersAtom.set({
            ...f,
            appId: f.appId === gId ? null : gId,
          }),
      });
      break;
    }
  }

  // 2. Early Access / Acesso Antecipado
  if (/early access|acesso antecipado/i.test(content)) {
    actions.push({
      id: 'ea',
      label: 'Recorte: Early Access',
      isActive: (f) => f.earlyAccess === 'yes',
      apply: (f) =>
        filtersAtom.set({
          ...f,
          earlyAccess: f.earlyAccess === 'yes' ? 'all' : 'yes',
        }),
    });
  }

  // 3. Reviews Negativas / Economia da Insatisfação
  if (/negativ|não recomendad|insatisfação/i.test(content)) {
    actions.push({
      id: 'rec-no',
      label: 'Recorte: Não recomendadas',
      isActive: (f) => f.recommended === 'no',
      apply: (f) =>
        filtersAtom.set({
          ...f,
          recommended: f.recommended === 'no' ? 'all' : 'no',
        }),
    });
  }

  // 4. Janela de Reembolso (< 1h e 1–2h) ou 500h+
  const playtimeRules: { pattern: RegExp; bucket: PlaytimeBucket; label: string }[] = [
    { pattern: /menos de 1\s*h|<\s*1\s*h|primeira hora|lt1/i, bucket: 'lt1', label: 'Faixa: < 1 h' },
    { pattern: /1\s*a\s*2\s*h|1–2\s*h|1-2\s*h|h1_2|janela de reembolso/i, bucket: 'h1_2', label: 'Faixa: 1 a 2 h' },
    { pattern: /500\s*h\+|500 horas|2\.000 horas|gte500/i, bucket: 'gte500', label: 'Faixa: 500 h+' },
  ];

  for (const rule of playtimeRules) {
    if (rule.pattern.test(content)) {
      actions.push({
        id: `play-${rule.bucket}`,
        label: rule.label,
        isActive: (f) => f.playtime === rule.bucket,
        apply: (f) =>
          filtersAtom.set({
            ...f,
            playtime: f.playtime === rule.bucket ? 'all' : rule.bucket,
          }),
      });
      break;
    }
  }

  // 5. Idiomas
  if (/português|brazilian|pt-br/i.test(content)) {
    actions.push({
      id: 'lang-br',
      label: 'Idioma: Português (BR)',
      isActive: (f) => f.language === 'brazilian',
      apply: (f) =>
        filtersAtom.set({
          ...f,
          language: f.language === 'brazilian' ? null : 'brazilian',
        }),
    });
  } else if (/inglês|english/i.test(content)) {
    actions.push({
      id: 'lang-en',
      label: 'Idioma: Inglês',
      isActive: (f) => f.language === 'english',
      apply: (f) =>
        filtersAtom.set({
          ...f,
          language: f.language === 'english' ? null : 'english',
        }),
    });
  } else if (/chinês|schinese/i.test(content)) {
    actions.push({
      id: 'lang-zh',
      label: 'Idioma: Chinês simplificado',
      isActive: (f) => f.language === 'schinese',
      apply: (f) =>
        filtersAtom.set({
          ...f,
          language: f.language === 'schinese' ? null : 'schinese',
        }),
    });
  }

  // 6. Reset se mencionado
  if (actions.length < 4 && /restaurar filtros|resetar filtros|limpar filtros|visão global/i.test(content)) {
    actions.push({
      id: 'reset',
      label: 'Limpar todos os filtros',
      isActive: (f) => activeFilterCount(f) === 0,
      apply: () => resetFilters(),
    });
  }

  return actions.slice(0, 4);
}

function renderInlineText(text: string): React.ReactNode[] {
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
  const parts = text.split(regex);
  return parts.map((part, index) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <code key={index} className="chat-inline-code">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      const [, label, url] = linkMatch;
      return (
        <a
          key={index}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="chat-inline-link"
        >
          {label}
        </a>
      );
    }
    return part;
  });
}

function splitTableRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|')) s = s.slice(0, -1);
  return s.split('|').map((cell) => cell.trim());
}

function isTableSeparatorLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes('|') && !trimmed.includes('-')) return false;
  const cells = splitTableRow(trimmed);
  return cells.length >= 2 && cells.every((c) => /^:?-{2,}:?$/.test(c.trim()));
}

function isNumericCell(text: string): boolean {
  const clean = text.replace(/\*\*/g, '').replace(/`/g, '').trim();
  return /^[+-]?[\d.,]+(\s*(%|h|p\.p\.|x|reviews|avaliações|jogos|autores))?$/i.test(clean);
}

function renderMessageContent(content: string, animateBlocks = false): React.ReactNode {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let idx = 0;
  let key = 0;

  while (idx < lines.length) {
    const line = lines[idx];
    const trimmed = line.trim();

    if (!trimmed) {
      idx++;
      continue;
    }

    // Bloco de código cercado por ```
    if (trimmed.startsWith('```')) {
      const codeLines: string[] = [];
      idx++;
      while (idx < lines.length && !lines[idx].trim().startsWith('```')) {
        codeLines.push(lines[idx]);
        idx++;
      }
      if (idx < lines.length) {
        idx++;
      }
      elements.push(
        <pre key={key++} className="chat-code-block">
          <code>{codeLines.join('\n')}</code>
        </pre>,
      );
      continue;
    }

    // Linha divisória horizontal
    if (/^---+$/.test(trimmed)) {
      elements.push(<hr key={key++} className="chat-divider" />);
      idx++;
      continue;
    }

    // Cabeçalho Markdown (1 a 4 hashtags)
    const headingMatch = trimmed.match(/^#{1,4}\s+(.*)$/);
    if (headingMatch) {
      elements.push(
        <h3 key={key++} className="chat-content-heading">
          {renderInlineText(headingMatch[1])}
        </h3>,
      );
      idx++;
      continue;
    }

    // Bloco de citação (> ...)
    if (/^>\s?(.*)$/.test(trimmed)) {
      const quoteLines: string[] = [];
      while (idx < lines.length && /^>\s?(.*)$/.test(lines[idx].trim())) {
        const match = lines[idx].trim().match(/^>\s?(.*)$/);
        quoteLines.push(match ? match[1] : lines[idx].slice(1));
        idx++;
      }
      elements.push(
        <blockquote key={key++} className="chat-blockquote">
          {quoteLines.map((qLine, qIdx) => (
            <span key={qIdx}>
              {qIdx > 0 && <br />}
              {renderInlineText(qLine)}
            </span>
          ))}
        </blockquote>,
      );
      continue;
    }

    // Lista não-ordenada (-, *, •)
    if (/^[-*•]\s+(.*)$/.test(trimmed)) {
      const listItems: string[] = [];
      while (idx < lines.length && /^[-*•]\s+(.*)$/.test(lines[idx].trim())) {
        const match = lines[idx].trim().match(/^[-*•]\s+(.*)$/);
        listItems.push(match ? match[1] : lines[idx]);
        idx++;
      }
      elements.push(
        <ul key={key++} className="chat-bullet-list">
          {listItems.map((item, itemIdx) => (
            <li key={itemIdx}>{renderInlineText(item)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    // Lista ordenada (1. ...)
    if (/^\d+\.\s+(.*)$/.test(trimmed)) {
      const listItems: string[] = [];
      while (idx < lines.length && /^\d+\.\s+(.*)$/.test(lines[idx].trim())) {
        const match = lines[idx].trim().match(/^\d+\.\s+(.*)$/);
        listItems.push(match ? match[1] : lines[idx]);
        idx++;
      }
      elements.push(
        <ol key={key++} className="chat-numbered-list">
          {listItems.map((item, itemIdx) => (
            <li key={itemIdx}>{renderInlineText(item)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    // Tabela Markdown GFM
    if (
      idx + 1 < lines.length &&
      trimmed.includes('|') &&
      isTableSeparatorLine(lines[idx + 1])
    ) {
      const headerCells = splitTableRow(lines[idx]);
      const separatorCells = splitTableRow(lines[idx + 1]);
      const colAligns: ('left' | 'center' | 'right')[] = headerCells.map((_, cIdx) => {
        const sep = (separatorCells[cIdx] ?? '').trim();
        const startsWithColon = sep.startsWith(':');
        const endsWithColon = sep.endsWith(':');
        if (startsWithColon && endsWithColon) return 'center';
        if (endsWithColon) return 'right';
        return 'left';
      });

      idx += 2;
      const bodyRows: string[][] = [];
      while (
        idx < lines.length &&
        lines[idx].trim().includes('|') &&
        !lines[idx].trim().startsWith('```')
      ) {
        const rowTrimmed = lines[idx].trim();
        if (!isTableSeparatorLine(rowTrimmed)) {
          bodyRows.push(splitTableRow(rowTrimmed));
        }
        idx++;
      }

      headerCells.forEach((_, cIdx) => {
        if (colAligns[cIdx] === 'left' && bodyRows.length > 0) {
          const numericCount = bodyRows.filter((row) => isNumericCell(row[cIdx] ?? '')).length;
          if (numericCount > bodyRows.length / 2) {
            colAligns[cIdx] = 'right';
          }
        }
      });

      elements.push(
        <div key={key++} className="chat-table-wrap">
          <table className="chat-table">
            <thead>
              <tr>
                {headerCells.map((hCell, cIdx) => (
                  <th
                    key={cIdx}
                    scope="col"
                    className={
                      colAligns[cIdx] === 'right'
                        ? 'chat-table-right'
                        : colAligns[cIdx] === 'center'
                        ? 'chat-table-center'
                        : 'chat-table-left'
                    }
                  >
                    {renderInlineText(hCell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bodyRows.map((row, rIdx) => (
                <tr key={rIdx}>
                  {headerCells.map((_, cIdx) => {
                    const cellText = row[cIdx] ?? '';
                    const align =
                      colAligns[cIdx] === 'right' || isNumericCell(cellText)
                        ? 'right'
                        : colAligns[cIdx];
                    return (
                      <td
                        key={cIdx}
                        className={
                          align === 'right'
                            ? 'chat-table-right'
                            : align === 'center'
                            ? 'chat-table-center'
                            : 'chat-table-left'
                        }
                      >
                        {renderInlineText(cellText)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    // Parágrafo de texto normal
    const paraLines: string[] = [];
    while (idx < lines.length) {
      const pTrimmed = lines[idx].trim();
      if (
        !pTrimmed ||
        pTrimmed.startsWith('```') ||
        /^---+$/.test(pTrimmed) ||
        /^#{1,4}\s+/.test(pTrimmed) ||
        /^>\s?/.test(pTrimmed) ||
        /^[-*•]\s+/.test(pTrimmed) ||
        /^\d+\.\s+/.test(pTrimmed) ||
        (idx + 1 < lines.length && pTrimmed.includes('|') && isTableSeparatorLine(lines[idx + 1]))
      ) {
        break;
      }
      paraLines.push(lines[idx]);
      idx++;
    }

    if (paraLines.length > 0) {
      elements.push(
        <p key={key++} className="chat-paragraph">
          {paraLines.map((pLine, pIdx) => (
            <span key={pIdx}>
              {pIdx > 0 && <br />}
              {renderInlineText(pLine)}
            </span>
          ))}
        </p>,
      );
    }
  }

  return (
    <div className="chat-body-content">
      {animateBlocks
        ? elements.map((el, bIdx) => (
            <div
              key={bIdx}
              className="chat-block-reveal"
              style={{ '--block-idx': Math.min(bIdx, 12) } as React.CSSProperties}
            >
              {el}
            </div>
          ))
        : elements}
    </div>
  );
}

function buildContextSummary(filters: Filters, metrics: ReturnType<typeof useLatestMetrics>): string {
  const count = activeFilterCount(filters);
  const totalReviews = metrics?.total_reviews;
  const totalFormatted = totalReviews !== undefined ? `${formatInteger(totalReviews)} reviews` : '1M reviews';

  if (count === 0) {
    return `Visão global (${totalFormatted})`;
  }

  const parts: string[] = [];
  if (filters.appId !== null) {
    const game = metrics?.games.find((g) => g.app_id === filters.appId);
    parts.push(game ? game.app_name : `Jogo #${filters.appId}`);
  }
  if (filters.language) {
    parts.push(languageLabel(filters.language));
  }
  if (filters.recommended !== 'all') {
    parts.push(filters.recommended === 'yes' ? 'Recomendadas' : 'Não recomendadas');
  }
  if (filters.playtime !== 'all') {
    parts.push(PLAYTIME_LABELS[filters.playtime] ?? filters.playtime);
  }
  if (filters.earlyAccess !== 'all') {
    parts.push(filters.earlyAccess === 'yes' ? 'Early Access' : 'Fora do EA');
  }
  if (filters.steamPurchase !== 'all') {
    parts.push(filters.steamPurchase === 'yes' ? 'Compra Steam' : 'Key externa');
  }
  if (filters.receivedForFree !== 'all') {
    parts.push(filters.receivedForFree === 'yes' ? 'Gratuito' : 'Pago');
  }
  if (filters.dateFrom || filters.dateTo) {
    if (filters.dateFrom && filters.dateTo) {
      parts.push(`${formatDate(filters.dateFrom)} a ${formatDate(filters.dateTo)}`);
    } else if (filters.dateFrom) {
      parts.push(`Desde ${formatDate(filters.dateFrom)}`);
    } else if (filters.dateTo) {
      parts.push(`Até ${formatDate(filters.dateTo)}`);
    }
  }

  return `${parts.join(' • ')} (${totalFormatted})`;
}

function buildSqlTickerLines(filters: Filters): string[] {
  const whereConditions: string[] = [];
  if (filters.appId !== null) {
    whereConditions.push(`app_id = ${filters.appId}`);
  }
  if (filters.language) {
    whereConditions.push(`language = '${filters.language}'`);
  }
  if (filters.recommended !== 'all') {
    whereConditions.push(`recommended = ${filters.recommended === 'yes' ? 1 : 0}`);
  }
  if (filters.playtime !== 'all') {
    whereConditions.push(`playtime_bucket = '${filters.playtime}'`);
  }
  if (filters.earlyAccess !== 'all') {
    whereConditions.push(`early_access = ${filters.earlyAccess === 'yes' ? 1 : 0}`);
  }
  if (filters.steamPurchase !== 'all') {
    whereConditions.push(`steam_purchase = ${filters.steamPurchase === 'yes' ? 1 : 0}`);
  }
  if (filters.receivedForFree !== 'all') {
    whereConditions.push(`received_for_free = ${filters.receivedForFree === 'yes' ? 1 : 0}`);
  }
  const whereClause = whereConditions.length > 0 ? whereConditions.join(' AND ') : '1=1';

  return [
    'SELECT COUNT(*), AVG(recommended) FROM reviews',
    `WHERE ${whereClause} -- 1M rows`,
    'GROUP BY playtime_bucket, language -- agregando métricas',
    'ORDER BY votes_up DESC -- sintetizando mediana e assimetria',
  ];
}

export function ChatIsland() {
  const filters = useFilters();
  const metrics = useLatestMetrics();
  const titleId = useId();

  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [teaserDismissed, setTeaserDismissed] = useState(false);
  const [teaserPaused, setTeaserPaused] = useState(false);
  const [teaserIndex, setTeaserIndex] = useState(0);
  const [messages, setMessages] = useState<MessageItem[]>([WELCOME_MESSAGE]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingElapsedMs, setLoadingElapsedMs] = useState(0);
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [freshBotMsgId, setFreshBotMsgId] = useState<string | null>(null);
  const [contextPulse, setContextPulse] = useState(false);
  const [isComposerShaking, setIsComposerShaking] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const lastBotMsgRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fabRef = useRef<HTMLButtonElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const confirmClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const composerShakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstMount = useRef(true);

  const contextSummary = useMemo(
    () => buildContextSummary(filters, metrics),
    [filters, metrics],
  );

  const activeFiltersCount = useMemo(() => activeFilterCount(filters), [filters]);

  const openDrawer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setIsClosing(false);
    setIsOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    if (!isOpen || isClosing) return;
    setIsClosing(true);
    closeTimerRef.current = setTimeout(() => {
      setIsOpen(false);
      setIsClosing(false);
      closeTimerRef.current = null;
    }, 220);
  }, [isOpen, isClosing]);

  // Detecção de viewport mobile para aria-modal condicional
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 640px)');
    setIsMobileViewport(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobileViewport(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Atalho global de teclado (Ctrl+K / ⌘K) para abrir/fechar o assistente
  useEffect(() => {
    function handleGlobalKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        if (isOpen && !isClosing) {
          closeDrawer();
        } else {
          openDrawer();
          setTimeout(() => textareaRef.current?.focus(), 100);
        }
      }
    }
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isOpen, isClosing, openDrawer, closeDrawer]);

  // Rotação periódica de teasers a cada 7 segundos (pausa quando drawer está aberto, dispensado ou no hover)
  useEffect(() => {
    if (isOpen || teaserDismissed || teaserPaused) return;
    const timer = setInterval(() => {
      setTeaserIndex((prev) => (prev + 1) % TEASER_ITEMS.length);
    }, 7000);
    return () => clearInterval(timer);
  }, [isOpen, teaserDismissed, teaserPaused]);

  // Telemetria com cronômetro decorrido durante loading (atualiza a cada 200ms)
  useEffect(() => {
    if (!isLoading) {
      setLoadingElapsedMs(0);
      return;
    }
    const start = Date.now();
    const timer = setInterval(() => {
      setLoadingElapsedMs(Date.now() - start);
    }, 200);
    return () => clearInterval(timer);
  }, [isLoading]);

  // Limpeza de timers e requisições pendentes no desmontar
  useEffect(() => {
    return () => {
      if (confirmClearTimerRef.current) {
        clearTimeout(confirmClearTimerRef.current);
      }
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
      if (composerShakeTimerRef.current) {
        clearTimeout(composerShakeTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Fechar com tecla Escape e foco no input ao abrir
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeDrawer();
        fabRef.current?.focus();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    const focusTimer = setTimeout(() => {
      textareaRef.current?.focus();
    }, 100);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(focusTimer);
    };
  }, [isOpen, closeDrawer]);

  // Pulso da barra de contexto ao alterar filtros com drawer aberto
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    if (!isOpen) return;
    setContextPulse(true);
    const timer = setTimeout(() => {
      setContextPulse(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [contextSummary, isOpen]);

  // Rolagem inteligente: início da resposta na chegada do bot, fim nas ações do usuário/loading
  useEffect(() => {
    if (!isOpen) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.role === 'assistant' && !isLoading) {
      lastBotMsgRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, messages, isLoading]);

  const handleStopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
  }, []);

  const handleSendMessage = useCallback(
    async (textToSend?: string) => {
      const text = (textToSend ?? inputValue).trim();
      if (!text || isLoading) return;

      const userMessageId = `user-${Date.now()}`;
      const newMessages: MessageItem[] = [
        ...messages,
        { id: userMessageId, role: 'user', content: text },
      ];

      setMessages(newMessages);
      setInputValue('');
      setIsLoading(true);
      setLastFailedPrompt(null);
      setShowSuggestions(false);

      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }

      // Prepara histórico conversacional das mensagens anteriores para a API
      const historyPayload: ChatHistoryItem[] = messages
        .filter((m) => !m.isError && m.id !== 'welcome')
        .map((m) => ({ role: m.role, content: m.content }));

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const response = await sendChatMessage(
          text,
          filters,
          historyPayload,
          controller.signal,
        );
        const botMsgId = `assistant-${Date.now()}`;
        setFreshBotMsgId(botMsgId);
        setMessages((prev) => [
          ...prev,
          {
            id: botMsgId,
            role: 'assistant',
            content: response.reply,
            tools_used: response.tools_used,
            context_label: contextSummary,
          },
        ]);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        const errorMessage =
          err instanceof Error
            ? err.message
            : 'Erro desconhecido ao comunicar com o assistente.';
        setLastFailedPrompt(text);
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: 'assistant',
            content: errorMessage,
            isError: true,
          },
        ]);
      } finally {
        abortControllerRef.current = null;
        setIsLoading(false);
      }
    },
    [inputValue, isLoading, messages, filters, contextSummary],
  );

  const currentTeaserItem = TEASER_ITEMS[teaserIndex] ?? TEASER_ITEMS[0];

  const handleTeaserClick = useCallback(
    (item: TeaserItem) => {
      openDrawer();
      if (messages.length === 1 && messages[0].id === 'welcome' && !isLoading) {
        void handleSendMessage(item.prompt);
      } else {
        setInputValue(item.prompt);
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 108)}px`;
          }
        }, 100);
      }
    },
    [openDrawer, messages, isLoading, handleSendMessage],
  );

  const handleClearHistory = useCallback(() => {
    if (messages.length <= 1) return;

    if (!confirmClear) {
      setConfirmClear(true);
      if (confirmClearTimerRef.current) clearTimeout(confirmClearTimerRef.current);
      confirmClearTimerRef.current = setTimeout(() => {
        setConfirmClear(false);
      }, 3000);
      return;
    }

    if (confirmClearTimerRef.current) clearTimeout(confirmClearTimerRef.current);
    setConfirmClear(false);
    setMessages([WELCOME_MESSAGE]);
    setLastFailedPrompt(null);
    setShowSuggestions(false);
    textareaRef.current?.focus();
  }, [confirmClear, messages.length]);

  const handleTextareaChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(event.target.value);
    const el = event.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 108)}px`;
  };

  const handleKeyDownTextarea = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (!inputValue.trim()) {
        if (composerShakeTimerRef.current) clearTimeout(composerShakeTimerRef.current);
        setIsComposerShaking(false);
        requestAnimationFrame(() => setIsComposerShaking(true));
        composerShakeTimerRef.current = setTimeout(() => {
          setIsComposerShaking(false);
          composerShakeTimerRef.current = null;
        }, 300);
        return;
      }
      void handleSendMessage();
      return;
    }

    if (event.key === 'ArrowUp' && !inputValue.trim()) {
      const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
      if (lastUserMsg) {
        event.preventDefault();
        setInputValue(lastUserMsg.content);
        requestAnimationFrame(() => {
          if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 108)}px`;
            textareaRef.current.selectionStart = lastUserMsg.content.length;
            textareaRef.current.selectionEnd = lastUserMsg.content.length;
          }
        });
      }
    }
  };

  const handleRetryLastPrompt = () => {
    if (lastFailedPrompt) {
      void handleSendMessage(lastFailedPrompt);
    }
  };

  const sqlTickerLines = useMemo(() => buildSqlTickerLines(filters), [filters]);
  const tickerIdx = Math.floor(loadingElapsedMs / 1300) % sqlTickerLines.length;

  const thinkingStage = loadingElapsedMs < 2200 ? 0 : loadingElapsedMs < 5500 ? 1 : 2;
  const stageText =
    thinkingStage === 0
      ? '1/3 Lendo filtros ativos e preparando consulta SQL...'
      : thinkingStage === 1
      ? '2/3 Executando agregações no SQLite (1.000.000 reviews)...'
      : '3/3 Sintetizando análise estatística no modelo...';
  const isSuggestionsOpen = (messages.length === 1 && !isLoading) || showSuggestions;

  return (
    <>
      {/* Botão Flutuante Fixo (FAB) + Balão Teaser */}
      {!isOpen && (
        <div className="chat-fab-container fixed bottom-6 right-6 z-40 flex items-center gap-3">
          {/* Balão Teaser Rotativo */}
          {!teaserDismissed && (
            <div
              className="chat-teaser group flex items-center gap-2"
              onMouseEnter={() => setTeaserPaused(true)}
              onMouseLeave={() => setTeaserPaused(false)}
              onFocus={() => setTeaserPaused(true)}
              onBlur={() => setTeaserPaused(false)}
            >
              <button
                type="button"
                onClick={() => handleTeaserClick(currentTeaserItem)}
                className="chat-teaser-btn text-left"
                title="Clique para abrir o chat com o SteamBot-9000"
              >
                <span key={teaserIndex} className="chat-teaser-text chat-teaser-swap">
                  {currentTeaserItem.text}
                </span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setTeaserDismissed(true);
                }}
                className="chat-teaser-close"
                aria-label="Dispensar aviso do SteamBot"
                title="Dispensar"
              >
                <RailIcon icon={X} className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Botão FAB principal */}
          <button
            ref={fabRef}
            type="button"
            onClick={openDrawer}
            className="chat-fab group"
            aria-label="Abrir assistente SteamBot-9000 (Ctrl+K)"
            aria-expanded={isOpen}
          >
            <div className="chat-fab-avatar">
              <RailIcon
                key={teaserIndex}
                icon={Bot}
                className="chat-fab-icon chat-fab-icon-nod w-6 h-6"
              />
              <span
                key={teaserIndex}
                className="chat-status-dot chat-status-dot-pop"
                aria-label="Status: Online"
              />
            </div>
            <span className="chat-fab-label hidden md:inline">SteamBot</span>
            <kbd className="chat-fab-kbd hidden lg:inline">Ctrl+K</kbd>
          </button>
        </div>
      )}

      {/* Modal / Drawer do Chat */}
      {isOpen && (
        <>
          {/* Backdrop para mobile */}
          <div
            className={`chat-backdrop ${isClosing ? 'is-closing' : ''}`}
            onClick={closeDrawer}
            aria-hidden="true"
          />

          <section
            role="dialog"
            aria-modal={isMobileViewport ? 'true' : undefined}
            aria-labelledby={titleId}
            className={`chat-drawer ${isExpanded ? 'chat-drawer-wide' : ''} ${isClosing ? 'is-closing' : ''}`}
          >
            {/* Header */}
            <header className="chat-header">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`chat-avatar-badge relative flex items-center justify-center ${isLoading ? 'is-thinking' : ''}`}>
                  <RailIcon icon={Bot} className="w-5 h-5 text-[var(--accent)]" />
                  <span className="chat-status-dot absolute -bottom-0.5 -right-0.5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 id={titleId} className="chat-title truncate">
                      SteamBot-9000
                    </h2>
                    <span className="chat-badge-model hidden sm:inline">SQL + IA</span>
                  </div>
                  <p className="chat-subtitle truncate" title="1.000.000 de avaliações • SQLite em tempo real">
                    1.000.000 de avaliações • SQLite em tempo real
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-none ml-2">
                <button
                  type="button"
                  disabled={messages.length <= 1 || isLoading}
                  onClick={handleClearHistory}
                  className={`chat-action-btn ${confirmClear ? 'chat-action-confirm' : ''}`}
                  title={confirmClear ? 'Clique para confirmar limpeza' : 'Limpar histórico da conversa'}
                  aria-label={confirmClear ? 'Confirmar limpeza do histórico' : 'Limpar histórico da conversa'}
                >
                  <span className="chat-icon-swap" data-state={confirmClear ? 'b' : 'a'}>
                    <span className="chat-icon-slot" data-icon="a">
                      <RailIcon icon={Trash2} className="w-4 h-4" />
                    </span>
                    <span className="chat-icon-slot" data-icon="b">
                      <span className="chat-confirm-label">Confirmar?</span>
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsExpanded((prev) => !prev)}
                  className="chat-action-btn hidden sm:flex"
                  title={isExpanded ? 'Restaurar largura padrão (440px)' : 'Expandir painel para tabelas (680px)'}
                  aria-label={isExpanded ? 'Restaurar largura padrão (440px)' : 'Expandir painel para tabelas (680px)'}
                >
                  <span className="chat-icon-swap" data-state={isExpanded ? 'b' : 'a'}>
                    <span className="chat-icon-slot" data-icon="a">
                      <RailIcon icon={Maximize2} className="w-4 h-4" />
                    </span>
                    <span className="chat-icon-slot" data-icon="b">
                      <RailIcon icon={Minimize2} className="w-4 h-4" />
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={closeDrawer}
                  className="chat-action-btn chat-action-close"
                  title="Fechar assistente (Esc)"
                  aria-label="Fechar assistente"
                >
                  <RailIcon icon={X} className="w-4 h-4" />
                </button>
              </div>
            </header>

            {/* Barra de Contexto do Recorte Atual */}
            <div
              className={`chat-context-bar ${contextPulse ? 'is-pulsing' : ''}`}
              role="region"
              aria-label="Recorte ativo no painel"
            >
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <RailIcon
                  icon={Sparkles}
                  className="w-3.5 h-3.5 text-[var(--accent)] flex-none"
                />
                <span className="truncate">
                  <strong className="text-[var(--ink)]">
                    {activeFiltersCount === 0 ? 'Recorte global' : `${activeFiltersCount} filtro(s)`}:
                  </strong>{' '}
                  <span key={contextSummary} className="chat-context-swap">
                    {contextSummary}
                  </span>
                </span>
              </div>
              {messages.length > 1 && (
                <button
                  type="button"
                  onClick={() => setShowSuggestions((prev) => !prev)}
                  className="chat-suggestions-toggle flex-none ml-2"
                  aria-expanded={showSuggestions}
                  title="Ver perguntas sugeridas"
                >
                  <RailIcon icon={MessageSquare} className="w-3 h-3" />
                  <span>{showSuggestions ? 'Ocultar' : 'Sugestões'}</span>
                </button>
              )}
            </div>

            {/* Área de Mensagens */}
            <div className="chat-messages" tabIndex={0} aria-label="Histórico de mensagens">
              {messages.map((item, idx) => {
                if (item.role === 'user') {
                  return (
                    <div key={item.id} className="chat-msg-row chat-msg-row-user chat-msg-enter">
                      <div className="chat-bubble chat-bubble-user">
                        {item.content}
                      </div>
                    </div>
                  );
                }

                if (item.isError) {
                  const isOpenRouterKeyError =
                    item.content.includes('OPENROUTER_API_KEY') ||
                    item.content.includes('chave') ||
                    item.content.includes('503') ||
                    item.content.includes('502');

                  return (
                    <div key={item.id} className="chat-msg-row chat-msg-row-bot chat-msg-enter">
                      <div className="chat-bubble chat-bubble-error">
                        <div className="flex items-start gap-2.5">
                          <RailIcon
                            icon={AlertCircle}
                            className="w-5 h-5 text-[var(--negative)] flex-none mt-0.5"
                          />
                          <div className="flex-1 min-w-0 text-sm">
                            <strong className="font-medium text-[var(--negative)] block mb-1">
                              Não foi possível consultar o SteamBot
                            </strong>
                            <p className="mb-2 text-[var(--ink)] opacity-90 leading-relaxed">
                              {item.content}
                            </p>
                            {isOpenRouterKeyError && (
                              <details className="chat-error-details">
                                <summary className="chat-error-summary">
                                  Como configurar a chave OPENROUTER_API_KEY
                                </summary>
                                <div className="chat-error-tip">
                                  <p className="mb-1.5">
                                    Defina a variável <code className="chat-inline-code">OPENROUTER_API_KEY</code> antes de iniciar o backend:
                                  </p>
                                  <pre className="font-mono text-[12px] bg-[var(--surface)] p-2 rounded border border-[var(--line)] overflow-x-auto select-all">
                                    $env:OPENROUTER_API_KEY="sua_chave_aqui"
                                  </pre>
                                </div>
                              </details>
                            )}
                            {lastFailedPrompt && (
                              <button
                                type="button"
                                onClick={handleRetryLastPrompt}
                                className="chat-retry-btn inline-flex items-center gap-1.5 mt-2"
                              >
                                <RailIcon icon={RotateCcw} className="w-3.5 h-3.5" />
                                <span>Tentar novamente</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                const isLastAssistant = idx === messages.length - 1 && item.role === 'assistant';
                const copilotActions =
                  item.id !== 'welcome' && !item.isError
                    ? extractFilterActions(item.content, metrics?.games ?? [])
                    : [];

                return (
                  <div
                    key={item.id}
                    ref={isLastAssistant ? lastBotMsgRef : undefined}
                    className={`chat-msg-row chat-msg-row-bot ${item.id !== 'welcome' ? 'chat-msg-enter' : ''}`}
                  >
                    <div className="chat-bubble chat-bubble-bot">
                      {renderMessageContent(item.content, item.id === freshBotMsgId)}

                      {/* Chips de Co-piloto Bidirecional: Aplicar no Painel */}
                      {copilotActions.length > 0 && (
                        <div className="chat-copilot-actions" role="group" aria-label="Ações de filtro sugeridas">
                          <span className="text-[12px] leading-[16px] text-[var(--secondary)] flex items-center gap-1 mr-1">
                            <RailIcon icon={Filter} className="w-3.5 h-3.5 text-[var(--accent)]" />
                            <span>Painel:</span>
                          </span>
                          {copilotActions.map((action, actionIdx) => {
                            const active = action.isActive(filters);
                            return (
                              <button
                                key={action.id}
                                type="button"
                                style={{ '--chip-idx': actionIdx } as React.CSSProperties}
                                onClick={() => action.apply(filters)}
                                className={`chat-copilot-chip ${active ? 'chat-copilot-chip-active' : ''}`}
                                title={active ? `Desativar filtro: ${action.label}` : `Aplicar no painel: ${action.label}`}
                              >
                                {active && (
                                  <svg className="chat-chip-check" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                                    <path
                                      d="M2.5 7.5L5.5 10.5L11.5 3.5"
                                      stroke="currentColor"
                                      strokeWidth="1.75"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                  </svg>
                                )}
                                <span>{action.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Metadados: recorte, ferramentas consultadas e botão de copiar Markdown */}
                      {item.id !== 'welcome' && (
                        <div className="chat-msg-meta" aria-label="Metadados da resposta">
                          {item.context_label && (
                            <span className="chat-meta-context" title={`Recorte consultado: ${item.context_label}`}>
                              {item.context_label}
                            </span>
                          )}
                          {item.tools_used && item.tools_used.length > 0 && (
                            <div className="chat-tools-list" aria-label="Ferramentas de dados consultadas">
                              {item.tools_used.map((tool, tIdx) => (
                                <span key={tIdx} className="chat-tool-badge">
                                  {TOOL_LABELS[tool] ?? tool}
                                </span>
                              ))}
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              void navigator.clipboard.writeText(item.content);
                              setCopiedMsgId(item.id);
                              setTimeout(() => {
                                setCopiedMsgId((prev) => (prev === item.id ? null : prev));
                              }, 2000);
                            }}
                            className={`chat-copy-btn ${copiedMsgId === item.id ? 'is-copied' : ''}`}
                            title="Copiar resposta como Markdown"
                            aria-label="Copiar resposta como Markdown"
                          >
                            <span className="chat-icon-swap" data-state={copiedMsgId === item.id ? 'b' : 'a'}>
                              <span className="chat-icon-slot" data-icon="a">
                                <RailIcon icon={Copy} className="w-3.5 h-3.5" />
                              </span>
                              <span className="chat-icon-slot" data-icon="b">
                                <RailIcon icon={Check} className="w-3.5 h-3.5" />
                              </span>
                            </span>
                            <span>{copiedMsgId === item.id ? 'Copiado' : 'Copiar'}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Indicador de carregamento */}
              {isLoading && (
                <div className="chat-msg-row chat-msg-row-bot chat-msg-enter">
                  <div className="chat-loading">
                    <div className="chat-loading-top">
                      <div className="chat-matrix" aria-hidden="true">
                        {Array.from({ length: 16 }).map((_, idx) => {
                          const isGap = idx === 0 || idx === 3 || idx === 12 || idx === 15;
                          return (
                            <i
                              key={idx}
                              className={isGap ? 'is-gap' : undefined}
                              style={
                                !isGap
                                  ? ({ '--d': (idx % 4) * 140 + Math.floor(idx / 4) * 45 } as React.CSSProperties)
                                  : undefined
                              }
                            />
                          );
                        })}
                      </div>
                      <div className="chat-thinking-stage-wrap" role="status" aria-live="polite">
                        <span
                          key={thinkingStage}
                          className="chat-thinking-shimmer chat-stage-enter"
                        >
                          {stageText}
                        </span>
                      </div>
                      <span className="chat-loading-timer" aria-hidden="true">
                        {(loadingElapsedMs / 1000).toFixed(1)}s
                      </span>
                    </div>
                    <div className="chat-step-track" aria-hidden="true">
                      {[0, 1, 2].map((step) => (
                        <span
                          key={step}
                          className={`chat-step-seg ${step <= thinkingStage ? 'is-active' : ''} ${step === thinkingStage ? 'is-current' : ''}`}
                        />
                      ))}
                    </div>
                    <div className="chat-sql-ticker" aria-hidden="true">
                      <RailIcon icon={Database} className="w-3 h-3 text-[var(--accent)] flex-none" />
                      <code key={tickerIdx} className="chat-sql-ticker-code chat-stage-enter">
                        {sqlTickerLines[tickerIdx]}
                      </code>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} aria-hidden="true" />
            </div>

            {/* Sugestões Rápidas (Chips com accordion-expand) */}
            <div
              className="chat-suggestions-accordion"
              data-open={isSuggestionsOpen ? 'true' : 'false'}
              aria-hidden={!isSuggestionsOpen}
            >
              <div className="chat-suggestions-inner" role="region" aria-label="Sugestões de perguntas">
                <div className="chat-suggestions-title">
                  <RailIcon icon={MessageSquare} className="w-3 h-3 text-[var(--accent)]" />
                  <span>Perguntas sugeridas para este recorte:</span>
                </div>
                <div className="chat-suggestions-list">
                  {SUGGESTED_QUESTIONS.map((question, qIdx) => (
                    <button
                      key={qIdx}
                      type="button"
                      disabled={isLoading}
                      tabIndex={isSuggestionsOpen ? 0 : -1}
                      onClick={() => void handleSendMessage(question)}
                      className="chat-chip"
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Rodapé / Input de Envio */}
            <footer className="chat-footer">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!inputValue.trim()) {
                    if (composerShakeTimerRef.current) clearTimeout(composerShakeTimerRef.current);
                    setIsComposerShaking(false);
                    requestAnimationFrame(() => setIsComposerShaking(true));
                    composerShakeTimerRef.current = setTimeout(() => {
                      setIsComposerShaking(false);
                      composerShakeTimerRef.current = null;
                    }, 300);
                    return;
                  }
                  void handleSendMessage();
                }}
                className={`chat-composer-box ${isLoading ? 'is-loading' : ''} ${isComposerShaking ? 'is-shaking' : ''}`}
              >
                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={inputValue}
                  onChange={handleTextareaChange}
                  onKeyDown={handleKeyDownTextarea}
                  disabled={isLoading}
                  placeholder="Faça uma pergunta sobre o recorte atual..."
                  className="chat-textarea"
                  aria-label="Mensagem para o assistente SteamBot-9000"
                />
                <div className="chat-composer-toolbar">
                  <span className="chat-input-hint">
                    <span className="hidden sm:inline">Enter para enviar • Shift+Enter para linha • ↑ última</span>
                    <span className="sm:hidden">Enter envia</span>
                  </span>
                  <div className="chat-composer-actions">
                    {isLoading ? (
                      <button
                        type="button"
                        onClick={handleStopGeneration}
                        className="chat-stop-btn"
                        title="Interromper geração"
                        aria-label="Interromper geração da resposta"
                      >
                        <RailIcon icon={Square} className="w-3.5 h-3.5" />
                        <span>Parar</span>
                      </button>
                    ) : (
                      <button
                        type="submit"
                        disabled={!inputValue.trim()}
                        className={`chat-send-btn ${inputValue.trim() ? 'is-ready' : ''}`}
                        aria-label="Enviar mensagem"
                        title="Enviar mensagem (Enter)"
                      >
                        <RailIcon icon={Send} className="w-3.5 h-3.5" />
                        <span className="chat-send-label">Enviar</span>
                      </button>
                    )}
                  </div>
                </div>
              </form>
            </footer>
          </section>
        </>
      )}
    </>
  );
}
