import React from 'react';
import { interpolateColors, useCurrentFrame } from 'remotion';
import { enterUp, progress } from '../anim';
import { Badge, MOCK, SearchIcon } from '../mock/ChatMock';
import { SEARCH } from '../mock/data';
import { Scene4_Search } from '../scenes/Scene4_Search';
import { COLORS, CONTENT, EASE_OUT, FONTS, TYPE, withAlpha } from '../tokens';

const ITEM_START = 285;
const ITEM_STAGGER = 18;
const HIGHLIGHT_START = 360;
const CALLOUT_SLOT_START = 360;
const CALLOUT_PILL_START = 364;
const CALLOUT_ROW_H = 46;

type EvidenceItem = (typeof SEARCH.evidence)[number];

const EvidenceRow: React.FC<{
  item: EvidenceItem;
  index: number;
  frame: number;
}> = ({ item, index, frame }) => {
  const appearP = progress(frame, ITEM_START + index * ITEM_STAGGER, 20, EASE_OUT);
  if (appearP <= 0) return null;

  const isChinese = item.language === 'chinês';
  const highlightP = isChinese ? progress(frame, HIGHLIGHT_START, 22, EASE_OUT) : 0;
  const calloutSlotP = isChinese ? progress(frame, CALLOUT_SLOT_START, 14, EASE_OUT) : 0;
  const calloutPillIn = isChinese ? enterUp(frame, CALLOUT_PILL_START, 18, 8) : { opacity: 0, translate: '0px 0px' };

  const borderColor = isChinese
    ? interpolateColors(highlightP, [0, 1], [COLORS.border, withAlpha(COLORS.emerald, 0.72)])
    : COLORS.border;
  const backgroundColor = isChinese
    ? interpolateColors(highlightP, [0, 1], [MOCK.wellBg, '#182822'])
    : MOCK.wellBg;
  const isFts = item.source === 'fts5';
  const sourceColor = isFts ? COLORS.amber : COLORS.emerald;
  const sourceLabel = isFts ? 'palavra' : 'significado';
  const isSettled = appearP >= 1;
  const collapsedMaxH = isChinese ? 140 : 104;

  return (
    <div
      style={{
        marginTop: index === 0 ? 0 : 10 * appearP,
        maxHeight: isSettled ? undefined : collapsedMaxH * appearP,
        overflow: isSettled ? 'visible' : 'hidden',
        opacity: appearP,
      }}
    >
      <div
        style={{
          borderRadius: 12,
          backgroundColor,
          border: `1px solid ${borderColor}`,
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          boxSizing: 'border-box',
          translate: `0px ${(1 - appearP) * 14}px`,
          boxShadow:
            highlightP > 0
              ? `0 0 ${24 * highlightP}px ${withAlpha(COLORS.emerald, 0.18 * highlightP)}`
              : undefined,
        }}
      >
      {/* Linha de metadados */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          minHeight: 34,
        }}
      >
        <Badge tone={item.recommended ? 'emerald' : 'red'}>
          {item.recommended ? 'Positiva' : 'Negativa'}
        </Badge>

        <span
          style={{
            fontFamily: FONTS.sans,
            fontSize: MOCK.small,
            fontWeight: 600,
            color: COLORS.text,
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
          }}
        >
          {item.language}
        </span>

        <span
          style={{
            fontFamily: FONTS.mono,
            fontSize: MOCK.small,
            color: COLORS.textSecondary,
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
          }}
        >
          · {item.hours}
        </span>

        <span
          style={{
            fontFamily: FONTS.mono,
            fontSize: MOCK.small,
            fontWeight: 500,
            padding: '3px 12px',
            borderRadius: 999,
            color: sourceColor,
            backgroundColor: withAlpha(sourceColor, 0.12),
            border: `1px solid ${withAlpha(sourceColor, 0.35)}`,
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
          }}
        >
          {sourceLabel}
        </span>

        <span
          style={{
            marginLeft: 'auto',
            fontFamily: FONTS.mono,
            fontSize: MOCK.small,
            color: COLORS.textSecondary,
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
          }}
        >
          {item.helpful.toLocaleString('pt-BR')} úteis
        </span>
      </div>

      {/* Trecho citado */}
      <div
        style={{
          fontFamily: FONTS.sans,
          fontSize: MOCK.text,
          lineHeight: 1.28,
          color: COLORS.textSecondary,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        “{item.excerpt}”
      </div>

      {/* Tradução do trecho em chinês */}
      {item.translation ? (
        <div
          style={{
            fontFamily: FONTS.sans,
            fontSize: MOCK.small,
            lineHeight: 1.25,
            color: COLORS.textMuted,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          ≈ {item.translation}
        </div>
      ) : null}

      {/* Pílula de destaque do achado semântico entre idiomas */}
      {isChinese && calloutSlotP > 0 ? (
        <div
          style={{
            height: CALLOUT_ROW_H * calloutSlotP,
            marginTop: 4 * calloutSlotP,
            overflow: calloutSlotP < 1 ? 'hidden' : 'visible',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              padding: '5px 16px',
              borderRadius: 999,
              border: `1px solid ${withAlpha(COLORS.emerald, 0.55)}`,
              backgroundColor: withAlpha(COLORS.emerald, 0.15),
              color: COLORS.emerald,
              fontFamily: FONTS.sans,
              fontSize: MOCK.small,
              fontWeight: 600,
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
              ...calloutPillIn,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                backgroundColor: COLORS.emerald,
                flexShrink: 0,
              }}
            />
            pergunta em português, trecho em chinês: achado pelo significado
          </div>
        </div>
      ) : null}
      </div>
    </div>
  );
};

/** Beat 3 (f250–480): widget de evidências da busca híbrida em motion. */
const EvidenceFinale: React.FC = () => {
  const frame = useCurrentFrame();

  const labelIn = enterUp(frame, 250, 22, 12);
  const blockIn = progress(frame, 250, 30, EASE_OUT);
  const blockScale = 0.96 + 0.04 * blockIn;
  const listOpenP = progress(frame, ITEM_START, 18, EASE_OUT);

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 6,
        width: CONTENT.width,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        fontFamily: FONTS.sans,
      }}
    >
      {/* Rótulo mono acima do widget */}
      <div
        style={{
          fontFamily: FONTS.mono,
          fontSize: TYPE.small,
          lineHeight: 1.2,
          color: COLORS.textMuted,
          ...labelIn,
        }}
      >
        o que volta para o chat · widget de evidências
      </div>

      {/* Card principal (ReviewEvidenceWidget redesenhado) */}
      <div
        style={{
          opacity: blockIn,
          scale: blockScale,
          transformOrigin: '50% 45%',
          borderRadius: MOCK.cardRadius,
          backgroundColor: COLORS.surface,
          border: `1px solid ${COLORS.borderLight}`,
          padding: '20px 24px',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
        }}
      >
        {/* Linha 1: ícone, título e modo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <SearchIcon size={26} color={COLORS.emerald} />
          <span
            style={{
              fontSize: 28,
              fontWeight: 600,
              color: COLORS.text,
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
            }}
          >
            Evidências da Busca Híbrida
          </span>
          <Badge tone="emerald" style={{ marginLeft: 'auto' }}>
            FTS5 + Vetor
          </Badge>
        </div>

        {/* Linha 2: tempo e acertos por trilha */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            marginTop: 12,
            paddingBottom: 12 * listOpenP,
            borderBottom: listOpenP > 0 ? `1px solid ${withAlpha('#F2F0EB', 0.09 * listOpenP)}` : 'none',
            fontFamily: FONTS.mono,
            fontSize: TYPE.small,
            lineHeight: 1.2,
            fontVariantNumeric: 'tabular-nums',
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{ color: COLORS.textSecondary }}>{SEARCH.toolMs} ms</span>
          <span>
            <span style={{ color: COLORS.amber, fontWeight: 500 }}>{SEARCH.ftsHits} por palavra</span>
            <span style={{ color: COLORS.textMuted }}> · </span>
            <span style={{ color: COLORS.emerald, fontWeight: 500 }}>{SEARCH.vecHits} por significado</span>
          </span>
        </div>

        {/* Lista dos 4 trechos */}
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 12 * listOpenP }}>
          {SEARCH.evidence.map((item, idx) => (
            <EvidenceRow
              key={`${item.language}-${item.hours}`}
              item={item}
              index={idx}
              frame={frame}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export const M4_Search: React.FC = () => <Scene4_Search finale={<EvidenceFinale />} />;
