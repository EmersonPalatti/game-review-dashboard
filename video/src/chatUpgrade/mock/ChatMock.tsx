/**
 * Kit da interface do chat redesenhada em motion (versão 100% motion).
 *
 * Mesma estrutura do chat real (ChatIsland + ChatGenUI), com tipografia maior
 * para ler no celular e as cores do vídeo (tokens.ts): âmbar = executando,
 * esmeralda = concluído/ganho do v2, vermelho = limite do v1.
 *
 * Os componentes são só apresentação: a cena calcula o progresso (0→1) de cada
 * peça a partir do frame e passa por props. Nada aqui chama useCurrentFrame,
 * exceto o que precisa girar sozinho (Spinner recebe o frame por prop).
 */
import React from 'react';
import { COLORS, FONTS, withAlpha } from '../tokens';

/* ───────────────────────────── medidas ───────────────────────────── */

export const MOCK = {
  radius: 22,
  cardRadius: 16,
  /** Fundo da bolha do assistente: um passo acima do surface. */
  bubbleBg: '#19191D',
  /** Fundo de bloco interno (timeline, loader, subcards). */
  wellBg: '#202024',
  text: 26,
  small: 24,
  rowH: 46,
} as const;

/* ───────────────────────────── ícones ───────────────────────────── */

interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  style?: React.CSSProperties;
}

const Svg: React.FC<IconProps & { children: React.ReactNode }> = ({
  size = 24,
  color = 'currentColor',
  strokeWidth = 2,
  style,
  children,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ display: 'block', flexShrink: 0, ...style }}
    aria-hidden
  >
    {children}
  </svg>
);

export const CheckCircleIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="10" />
    <path d="m9 12 2 2 4-4" />
  </Svg>
);

/** Loader2 do Lucide. Gira pelo frame (determinístico no render). */
export const Spinner: React.FC<IconProps & { frame: number }> = ({ frame, ...p }) => (
  <Svg {...p} style={{ ...p.style, rotate: `${(frame * 9) % 360}deg` }}>
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </Svg>
);

export const FilterIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </Svg>
);

export const UndoIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11" />
  </Svg>
);

export const CompareIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <circle cx="18" cy="18" r="3" />
    <circle cx="6" cy="6" r="3" />
    <path d="M13 6h3a2 2 0 0 1 2 2v7" />
    <path d="M11 18H8a2 2 0 0 1-2-2V9" />
  </Svg>
);

export const SearchIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </Svg>
);

export const DatabaseIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M3 5v14a9 3 0 0 0 18 0V5" />
    <path d="M3 12a9 3 0 0 0 18 0" />
  </Svg>
);

export const ChevronRightIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="m9 18 6-6-6-6" />
  </Svg>
);

export const BotIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M12 8V4H8" />
    <rect width="16" height="12" x="4" y="8" rx="2" />
    <path d="M2 14h2" />
    <path d="M20 14h2" />
    <path d="M15 13v2" />
    <path d="M9 13v2" />
  </Svg>
);

/** Seta do cursor (a mesma desenhada sobre as tomadas reais). */
export const ArrowCursor: React.FC<{ pressed: boolean; size: number }> = ({ pressed, size }) => (
  <svg width={size} height={size * 1.4} viewBox="0 0 20 28" style={{ display: 'block', overflow: 'visible' }}>
    <path
      d="M2 2 L2 22 L7.5 17 L11 25.5 L14.5 24 L11 15.8 L18 15.8 Z"
      fill="#F2F0EB"
      stroke="#0E0E10"
      strokeWidth={1.6}
      strokeLinejoin="round"
      style={{ transform: pressed ? 'scale(0.9)' : undefined, transformOrigin: '2px 2px' }}
    />
  </svg>
);

/* ───────────────────────────── moldura ───────────────────────────── */

interface MockPanelProps {
  version: 'v1' | 'v2';
  width: number;
  height: number;
  /** Linha abaixo do nome. Padrão: base inteira do SQLite. */
  subtitle?: string;
  showHeader?: boolean;
  style?: React.CSSProperties;
  /** Conteúdo da área de mensagens (posicionado a partir do canto superior esquerdo). */
  children?: React.ReactNode;
}

export const PANEL_HEADER_H = 92;

/** Painel do chat: cabeçalho do SteamBot-9000 e área de mensagens com overflow escondido. */
export const MockPanel: React.FC<MockPanelProps> = ({
  version,
  width,
  height,
  subtitle = '1.000.000 de avaliações · SQLite',
  showHeader = true,
  style,
  children,
}) => {
  const badge = version === 'v2' ? 'MCP · AG-UI' : 'SQL + IA';
  const badgeColor = version === 'v2' ? COLORS.emerald : COLORS.textSecondary;
  return (
    <div
      style={{
        position: 'relative',
        width,
        height,
        borderRadius: MOCK.radius,
        border: `1px solid ${COLORS.borderLight}`,
        backgroundColor: COLORS.surface,
        overflow: 'hidden',
        fontFamily: FONTS.sans,
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {showHeader ? (
        <div
          style={{
            height: PANEL_HEADER_H,
            display: 'flex',
            alignItems: 'center',
            gap: 18,
            padding: '0 26px',
            borderBottom: `1px solid ${COLORS.border}`,
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              width: 50,
              height: 50,
              borderRadius: 14,
              backgroundColor: MOCK.wellBg,
              border: `1px solid ${COLORS.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <BotIcon size={28} color={COLORS.text} strokeWidth={1.8} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ fontSize: 28, fontWeight: 600, color: COLORS.text, lineHeight: 1.1 }}>SteamBot-9000</span>
              <span
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: 20,
                  fontWeight: 500,
                  padding: '3px 10px',
                  borderRadius: 6,
                  color: badgeColor,
                  backgroundColor: withAlpha(version === 'v2' ? COLORS.emerald : '#A1A1A6', 0.1),
                  border: `1px solid ${withAlpha(version === 'v2' ? COLORS.emerald : '#A1A1A6', 0.35)}`,
                }}
              >
                {badge}
              </span>
            </div>
            <span style={{ fontSize: 22, color: COLORS.textMuted, lineHeight: 1.1 }}>{subtitle}</span>
          </div>
        </div>
      ) : null}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: showHeader ? PANEL_HEADER_H : 0,
          bottom: 0,
          overflow: 'hidden',
        }}
      >
        {children}
      </div>
    </div>
  );
};

/* ───────────────────────────── mensagens ───────────────────────────── */

/** Bolha da pergunta, alinhada à direita. */
export const UserBubble: React.FC<{ text: string; maxWidth?: number | string; style?: React.CSSProperties }> = ({
  text,
  maxWidth = '84%',
  style,
}) => (
  <div style={{ display: 'flex', justifyContent: 'flex-end', ...style }}>
    <div
      style={{
        maxWidth,
        padding: '16px 22px',
        borderRadius: `${MOCK.radius}px ${MOCK.radius}px 6px ${MOCK.radius}px`,
        backgroundColor: withAlpha(COLORS.emerald, 0.15),
        border: `1px solid ${withAlpha(COLORS.emerald, 0.38)}`,
        color: COLORS.text,
        fontSize: MOCK.text,
        lineHeight: 1.35,
        fontWeight: 500,
        boxSizing: 'border-box',
      }}
    >
      {text}
    </div>
  </div>
);

/** Bolha do assistente (contêiner). */
export const BotBubble: React.FC<{ style?: React.CSSProperties; children: React.ReactNode }> = ({ style, children }) => (
  <div
    style={{
      padding: 18,
      borderRadius: `${MOCK.radius}px ${MOCK.radius}px ${MOCK.radius}px 6px`,
      backgroundColor: MOCK.bubbleBg,
      border: `1px solid ${COLORS.border}`,
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      boxSizing: 'border-box',
      ...style,
    }}
  >
    {children}
  </div>
);

/** Selo mono pequeno (p.p., modo da busca, ms). */
export const Badge: React.FC<{ tone?: 'emerald' | 'amber' | 'red' | 'neutral'; children: React.ReactNode; style?: React.CSSProperties }> = ({
  tone = 'neutral',
  children,
  style,
}) => {
  const color =
    tone === 'emerald' ? COLORS.emerald : tone === 'amber' ? COLORS.amber : tone === 'red' ? COLORS.red : COLORS.textSecondary;
  return (
    <span
      style={{
        fontFamily: FONTS.mono,
        fontSize: MOCK.small,
        fontWeight: 500,
        fontVariantNumeric: 'tabular-nums',
        padding: '4px 12px',
        borderRadius: 8,
        color,
        backgroundColor: tone === 'neutral' ? MOCK.wellBg : withAlpha(color, 0.13),
        whiteSpace: 'nowrap',
        lineHeight: 1.25,
        ...style,
      }}
    >
      {children}
    </span>
  );
};

/* ───────────────────────────── timeline de ferramentas ───────────────────────────── */

export type StepState = 'hidden' | 'running' | 'done';

export interface TimelineStep {
  label: string;
  meta?: string;
  ms?: number;
  state: StepState;
  /** Entrada da linha, 0→1. */
  appear?: number;
}

interface ToolTimelineProps {
  steps: TimelineStep[];
  frame: number;
  /** Texto do cabeçalho ao vivo (a UI troca entre "Consultando…" e "Sintetizando…"). */
  liveLabel: string;
  /** Contador do cabeçalho, já formatado ("3,8 s"). */
  elapsed?: string;
  /** 0 = lista aberta (ao vivo); 1 = resumo recolhido ("4 consultas MCP · 260 ms"). */
  collapse?: number;
  summary?: string;
  width?: number | string;
}

const TL_PAD = 14;
const TL_HEAD_H = 46;
const TL_SUMMARY_H = 54;

/** Altura do bloco aberto com `rows` linhas visíveis. */
export function timelineOpenHeight(rows: number): number {
  return TL_PAD * 2 + TL_HEAD_H + rows * MOCK.rowH;
}

/** Linha do tempo das ferramentas MCP (ToolExecutionTimeline no ChatGenUI). */
export const ToolTimeline: React.FC<ToolTimelineProps> = ({
  steps,
  frame,
  liveLabel,
  elapsed,
  collapse = 0,
  summary,
  width = '100%',
}) => {
  const visible = steps.filter((s) => s.state !== 'hidden');
  const rowsH = visible.reduce((acc, s) => acc + MOCK.rowH * Math.min(1, s.appear ?? 1), 0);
  const openH = TL_PAD * 2 + TL_HEAD_H + rowsH;
  const height = openH + (TL_SUMMARY_H - openH) * collapse;
  return (
    <div
      style={{
        position: 'relative',
        width,
        height,
        borderRadius: 14,
        backgroundColor: MOCK.wellBg,
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      {/* Lista ao vivo */}
      <div style={{ padding: TL_PAD, opacity: Math.max(0, 1 - collapse * 2) }}>
        <div
          style={{
            height: TL_HEAD_H,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: MOCK.small,
            fontWeight: 600,
            color: COLORS.text,
          }}
        >
          <span>{liveLabel}</span>
          {elapsed ? (
            <span style={{ fontFamily: FONTS.mono, fontWeight: 500, color: COLORS.textSecondary, fontVariantNumeric: 'tabular-nums' }}>
              {elapsed}
            </span>
          ) : null}
        </div>
        {visible.map((step, i) => {
          const a = Math.min(1, step.appear ?? 1);
          return (
            <div
              key={`${step.label}-${i}`}
              style={{
                height: MOCK.rowH * a,
                opacity: a,
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                fontSize: MOCK.small,
                overflow: 'hidden',
              }}
            >
              {step.state === 'running' ? (
                <Spinner frame={frame} size={26} color={COLORS.amber} />
              ) : (
                <CheckCircleIcon size={26} color={COLORS.emerald} />
              )}
              <span style={{ fontWeight: 600, color: COLORS.text, whiteSpace: 'nowrap' }}>{step.label}</span>
              {step.meta ? (
                <span style={{ color: COLORS.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {step.meta}
                </span>
              ) : null}
              <span
                style={{
                  marginLeft: 'auto',
                  fontFamily: FONTS.mono,
                  color: step.state === 'done' ? COLORS.emerald : COLORS.amber,
                  fontVariantNumeric: 'tabular-nums',
                  whiteSpace: 'nowrap',
                }}
              >
                {step.state === 'done' && typeof step.ms === 'number' ? `${step.ms} ms` : step.state === 'running' ? '…' : ''}
              </span>
            </div>
          );
        })}
      </div>

      {/* Resumo recolhido */}
      {collapse > 0 ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            height: TL_SUMMARY_H,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: `0 ${TL_PAD + 4}px`,
            fontSize: MOCK.small,
            color: COLORS.text,
            opacity: Math.max(0, (collapse - 0.45) / 0.55),
          }}
        >
          <DatabaseIcon size={24} color={COLORS.emerald} />
          <span style={{ fontWeight: 500 }}>{summary}</span>
          <ChevronRightIcon size={24} color={COLORS.textMuted} style={{ marginLeft: 'auto' }} />
        </div>
      ) : null}
    </div>
  );
};

/* ───────────────────────────── widget comparativo ───────────────────────────── */

export interface ComparisonSide {
  label: string;
  pct: number;
  reviews: number;
  helpful: string;
}

/** Formata 90.4 → "90,40%". */
export function formatPct(value: number, digits = 2): string {
  return `${value.toFixed(digits).replace('.', ',')}%`;
}

/** Widget "comparison" do GenUI: título, delta em p.p. e dois subcards. */
export const ComparisonCard: React.FC<{
  title: string;
  delta: string;
  a: ComparisonSide;
  b: ComparisonSide;
  /** Contagem dos percentuais, 0→1. */
  count?: number;
  /** Versão para colunas estreitas (~500 px): título e números menores, meta em sans. */
  compact?: boolean;
  style?: React.CSSProperties;
}> = ({ title, delta, a, b, count = 1, compact = false, style }) => (
  <div
    style={{
      borderRadius: MOCK.cardRadius,
      backgroundColor: COLORS.surface,
      border: `1px solid ${COLORS.borderLight}`,
      padding: 18,
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      boxSizing: 'border-box',
      ...style,
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <CompareIcon size={26} color={COLORS.emerald} />
      <span
        style={{
          fontSize: compact ? MOCK.small : MOCK.text,
          fontWeight: 600,
          color: COLORS.text,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          minWidth: 0,
        }}
      >
        {title}
      </span>
      <Badge tone="emerald" style={{ marginLeft: 'auto', opacity: count }}>
        {delta}
      </Badge>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
      {[a, b].map((side) => (
        <div
          key={side.label}
          style={{
            borderRadius: 12,
            backgroundColor: MOCK.wellBg,
            padding: compact ? '12px 14px' : '14px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <span style={{ fontSize: MOCK.small, color: COLORS.textSecondary, whiteSpace: 'nowrap' }}>{side.label}</span>
          <span
            style={{
              fontFamily: FONTS.sans,
              fontSize: compact ? 46 : 52,
              fontWeight: 600,
              color: COLORS.text,
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
            }}
          >
            {formatPct(side.pct * count)}
          </span>
          <span
            style={{
              fontFamily: compact ? FONTS.sans : FONTS.mono,
              fontSize: MOCK.small,
              color: COLORS.textMuted,
              whiteSpace: 'nowrap',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {side.reviews.toLocaleString('pt-BR')} reviews
          </span>
        </div>
      ))}
    </div>
  </div>
);

/* ───────────────────────────── chip de filtro ───────────────────────────── */

/** "Painel: [chip] [Desfazer]" (StructuredFilterChips). */
export const ChipRow: React.FC<{
  label: string;
  /** 0→1: chip aplicado (fundo esmeralda + check). */
  active?: number;
  /** 0→1: botão Desfazer aparecendo. */
  undo?: number;
  /** Escala do toque no chip (1 = solto). */
  press?: number;
  style?: React.CSSProperties;
  chipRef?: React.Ref<HTMLDivElement>;
}> = ({ label, active = 0, undo = 0, press = 1, style, chipRef }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'nowrap', ...style }}>
    <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: MOCK.small, color: COLORS.textSecondary }}>
      <FilterIcon size={24} color={COLORS.emerald} />
      Painel:
    </span>
    <div
      ref={chipRef}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 20px',
        borderRadius: 999,
        border: `1.5px solid ${withAlpha(COLORS.emerald, 0.5 + 0.3 * active)}`,
        backgroundColor: withAlpha(COLORS.emerald, 0.06 + 0.16 * active),
        color: COLORS.emerald,
        fontSize: MOCK.small,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        scale: press,
      }}
    >
      {active > 0 ? (
        <svg width={22 * active} height={22} viewBox="0 0 14 14" fill="none" style={{ opacity: active }} aria-hidden>
          <path d="M2.5 7.5L5.5 10.5L11.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : null}
      {label}
    </div>
    {undo > 0 ? (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '9px 16px',
          borderRadius: 10,
          backgroundColor: MOCK.wellBg,
          color: COLORS.textSecondary,
          fontSize: MOCK.small,
          opacity: undo,
          translate: `${(1 - undo) * -10}px 0px`,
          whiteSpace: 'nowrap',
        }}
      >
        <UndoIcon size={22} color={COLORS.textSecondary} />
        Desfazer
      </div>
    ) : null}
  </div>
);

/* ───────────────────────────── texto em streaming ───────────────────────────── */

export interface TextSegment {
  text: string;
  bold: boolean;
}

/** Texto chegando token a token: mostra `progress` (0→1) dos caracteres, com cursor no fim. */
export const StreamText: React.FC<{
  segments: readonly TextSegment[];
  progress: number;
  frame: number;
  fontSize?: number;
  style?: React.CSSProperties;
}> = ({ segments, progress, frame, fontSize = MOCK.text, style }) => {
  const total = segments.reduce((acc, s) => acc + s.text.length, 0);
  let budget = Math.round(total * Math.max(0, Math.min(1, progress)));
  const streaming = progress > 0 && progress < 1;
  return (
    <div style={{ fontSize, lineHeight: 1.42, color: COLORS.text, position: 'relative', ...style }}>
      {segments.map((s, i) => {
        if (budget <= 0) return null;
        const shown = s.text.slice(0, budget);
        budget -= s.text.length;
        return (
          <span key={i} style={{ fontWeight: s.bold ? 650 : 400, color: s.bold ? COLORS.text : COLORS.textSecondary }}>
            {shown}
          </span>
        );
      })}
      {streaming ? (
        <span
          style={{
            display: 'inline-block',
            width: 12,
            height: fontSize * 0.95,
            marginLeft: 4,
            verticalAlign: 'text-bottom',
            backgroundColor: COLORS.emerald,
            opacity: Math.floor(frame / 8) % 2 === 0 ? 1 : 0.35,
          }}
        />
      ) : null}
    </div>
  );
};
