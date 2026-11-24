import React from 'react';
import { useCurrentFrame } from 'remotion';
import { enterUp, progress } from '../anim';
import { Counter } from '../components/Counter';
import { SceneShell } from '../components/SceneShell';
import { Tag } from '../components/Tag';
import { COLORS, FONTS } from '../tokens';

interface ProofMetricRowProps {
  start: number;
  numberNode: React.ReactNode;
  description: string;
  extra?: React.ReactNode;
  showDivider?: boolean;
}

const ProofMetricRow: React.FC<ProofMetricRowProps> = ({
  start,
  numberNode,
  description,
  extra,
  showDivider = true,
}) => {
  const frame = useCurrentFrame();
  const rowIn = enterUp(frame, start, 24, 20);
  const dividerW = progress(frame, start, 24) * 100;

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          minHeight: 132,
          padding: '16px 0',
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'baseline',
          gap: 24,
          ...rowIn,
        }}
      >
        <div
          style={{
            width: 260,
            flexShrink: 0,
            fontFamily: FONTS.mono,
            fontSize: 88,
            fontWeight: 600,
            lineHeight: 1,
            letterSpacing: '-0.03em',
            color: COLORS.emerald,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {numberNode}
        </div>

        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: 10,
          }}
        >
          <span
            style={{
              fontFamily: FONTS.sans,
              fontSize: 30,
              fontWeight: 500,
              lineHeight: 1.22,
              color: COLORS.text,
            }}
          >
            {description}
          </span>
          {extra}
        </div>
      </div>

      {showDivider ? (
        <div
          style={{
            height: 1,
            width: `${dividerW}%`,
            backgroundColor: COLORS.border,
          }}
        />
      ) : null}
    </div>
  );
};

const ThumbIcon: React.FC<{ direction: 'up' | 'down' }> = ({ direction }) => (
  <svg
    width={28}
    height={28}
    viewBox="0 0 24 24"
    fill="none"
    stroke={COLORS.textSecondary}
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flexShrink: 0 }}
  >
    {direction === 'up' ? (
      <>
        <path d="M7 10v12" />
        <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
      </>
    ) : (
      <>
        <path d="M17 14V2" />
        <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z" />
      </>
    )}
  </svg>
);

export const Scene6_Proof: React.FC = () => {
  const frame = useCurrentFrame();
  const feedbackIn = enterUp(frame, 150, 24, 16);

  return (
    <SceneShell
      kicker="pytest · DeepEval · Langfuse"
      headline="Upgrade que se mede."
      why="Em dashboard, número inventado é o pior bug."
      whyFrom={180}
    >
      <div
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <ProofMetricRow
          start={30}
          numberNode={<Counter from={0} to={76} start={30} duration={30} />}
          description="testes offline passando"
        />

        <ProofMetricRow
          start={54}
          numberNode={<Counter from={0} to={267} start={54} duration={30} />}
          description="eventos AG-UI numa conversa ao vivo"
          extra={
            <Tag tone="emerald" fontSize={24} style={{ padding: '6px 16px' }}>
              0 erros
            </Tag>
          }
        />

        <ProofMetricRow
          start={78}
          numberNode={<Counter from={0} to={2} start={78} duration={30} />}
          description="métricas de eval ao vivo"
          extra={
            <span
              style={{
                fontFamily: FONTS.mono,
                fontSize: 24,
                color: COLORS.textMuted,
                lineHeight: 1.3,
              }}
            >
              ToolCorrectness · Faithfulness
            </span>
          }
        />

        <ProofMetricRow
          start={102}
          numberNode="$0"
          description="em LLM e embeddings"
          showDivider={false}
        />

        <div
          style={{
            marginTop: 28,
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 10,
            fontFamily: FONTS.sans,
            fontSize: 26,
            lineHeight: 1.35,
            color: COLORS.textSecondary,
            ...feedbackIn,
          }}
        >
          <span>Traces no Langfuse e</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <ThumbIcon direction="up" />
            <ThumbIcon direction="down" />
          </span>
          <span>ligado a cada resposta.</span>
        </div>
      </div>
    </SceneShell>
  );
};
