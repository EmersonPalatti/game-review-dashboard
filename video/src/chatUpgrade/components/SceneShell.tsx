import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { enterUp, progress } from '../anim';
import { CANVAS, COLORS, CONTENT, FONTS, LAYOUT, TYPE } from '../tokens';

interface SceneShellProps {
  /** Linha mono pequena acima da headline. Vai em caixa alta. */
  kicker?: string;
  /** O que mudou. No máximo 2 linhas a 64 px. */
  headline?: React.ReactNode;
  /** Por que precisava mudar. Uma frase. */
  why?: string;
  /** Frame (local da cena) em que a headline entra. */
  headlineFrom?: number;
  /** Frame (local da cena) em que a linha do porquê entra. */
  whyFrom?: number;
  /** Conteúdo da zona central (936 × 750, origem no canto superior esquerdo da zona). */
  children?: React.ReactNode;
}

/**
 * Moldura comum das cenas em 4:5: kicker + headline no topo, zona de conteúdo
 * no meio e a linha do porquê embaixo. A base (y > 1200) fica livre para o
 * player do LinkedIn.
 */
export const SceneShell: React.FC<SceneShellProps> = ({
  kicker,
  headline,
  why,
  headlineFrom = 0,
  whyFrom = 36,
  children,
}) => {
  const frame = useCurrentFrame();
  const kickerIn = enterUp(frame, headlineFrom, 20, 12);
  const headlineIn = enterUp(frame, headlineFrom + 6, 26, 28);
  const whyIn = enterUp(frame, whyFrom, 24, 16);
  const ruleGrow = progress(frame, whyFrom, 30);

  return (
    <AbsoluteFill style={{ width: CANVAS.width, height: CANVAS.height, fontFamily: FONTS.sans }}>
      {kicker ? (
        <div
          style={{
            position: 'absolute',
            left: LAYOUT.marginX,
            top: LAYOUT.kickerTop,
            fontFamily: FONTS.mono,
            fontSize: TYPE.kicker,
            fontWeight: 500,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: COLORS.textMuted,
            ...kickerIn,
          }}
        >
          {kicker}
        </div>
      ) : null}

      {headline ? (
        <div
          style={{
            position: 'absolute',
            left: LAYOUT.marginX,
            right: LAYOUT.marginX,
            top: LAYOUT.headlineTop,
            fontSize: TYPE.headline,
            fontWeight: 600,
            lineHeight: 1.08,
            letterSpacing: '-0.025em',
            color: COLORS.text,
            textWrap: 'balance',
            ...headlineIn,
          }}
        >
          {headline}
        </div>
      ) : null}

      <div
        style={{
          position: 'absolute',
          left: CONTENT.left,
          top: CONTENT.top,
          width: CONTENT.width,
          height: CONTENT.height,
        }}
      >
        {children}
      </div>

      {why ? (
        <div style={{ position: 'absolute', left: LAYOUT.marginX, right: LAYOUT.marginX, top: LAYOUT.whyTop }}>
          <div
            style={{
              height: 1,
              width: `${ruleGrow * 100}%`,
              backgroundColor: COLORS.border,
              marginBottom: 18,
            }}
          />
          <div
            style={{
              fontSize: TYPE.why,
              lineHeight: 1.25,
              color: COLORS.textSecondary,
              textWrap: 'balance',
              ...whyIn,
            }}
          >
            {why}
          </div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
