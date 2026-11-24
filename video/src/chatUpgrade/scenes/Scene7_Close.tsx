import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { enterUp, progress } from '../anim';
import { Tag } from '../components/Tag';
import { CANVAS, COLORS, FONTS, LAYOUT } from '../tokens';

const PILLS = [
  'LangChain v1',
  'FastMCP',
  'FTS5 + sqlite-vec',
  'AG-UI',
  'Langfuse',
  'DeepEval',
] as const;

const STATEMENTS = [
  { text: 'Não foi troca de modelo.', color: COLORS.textSecondary, start: 0 },
  { text: 'Foi uma arquitetura nova de agente.', color: COLORS.text, start: 24 },
  {
    text: 'Catálogo inteiro. Busca no texto. Processo à vista.',
    color: COLORS.emerald,
    start: 48,
  },
] as const;

export const Scene7_Close: React.FC = () => {
  const frame = useCurrentFrame();
  const ruleWidth = progress(frame, 80, 28) * 100;
  const footerIn = enterUp(frame, 120, 26, 16);

  return (
    <AbsoluteFill
      style={{
        width: CANVAS.width,
        height: CANVAS.height,
        fontFamily: FONTS.sans,
      }}
    >
      <div
        style={{
          paddingLeft: LAYOUT.marginX,
          paddingRight: LAYOUT.marginX,
          paddingBottom: CANVAS.height - LAYOUT.safeBottom,
          height: '100%',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {STATEMENTS.map((item) => {
            const anim = enterUp(frame, item.start, 28, 24);
            return (
              <div
                key={item.text}
                style={{
                  fontSize: 68,
                  fontWeight: 700,
                  lineHeight: 1.08,
                  letterSpacing: '-0.03em',
                  color: item.color,
                  textWrap: 'balance',
                  ...anim,
                }}
              >
                {item.text}
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 48 }}>
          <div
            style={{
              height: 1,
              width: `${ruleWidth}%`,
              backgroundColor: COLORS.border,
            }}
          />

          <div
            style={{
              marginTop: 32,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 14,
            }}
          >
            {PILLS.map((label, idx) => {
              const pillIn = enterUp(frame, 90 + idx * 8, 20, 14);
              return (
                <div key={label} style={pillIn}>
                  <Tag tone="neutral" shape="pill" fontSize={26}>
                    {label}
                  </Tag>
                </div>
              );
            })}
          </div>

          <div
            style={{
              marginTop: 36,
              fontFamily: FONTS.mono,
              fontSize: 26,
              lineHeight: 1.35,
              color: COLORS.textSecondary,
              ...footerIn,
            }}
          >
            SteamBot-9000 v2 · 998.533 reviews da Steam · 59 jogos
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
