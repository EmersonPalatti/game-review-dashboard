import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

interface EndCardProps {
  startFrame: number;
}

export const EndCard: React.FC<EndCardProps> = ({ startFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const relFrame = frame - startFrame;
  if (relFrame < 0) {
    return null;
  }

  // Smooth entrance
  const entrance = spring({
    frame: relFrame,
    fps,
    config: { damping: 18, stiffness: 70 },
  });

  const opacity = interpolate(entrance, [0, 1], [0, 1]);
  const scale = interpolate(entrance, [0, 1], [0.94, 1]);
  const translateY = interpolate(entrance, [0, 1], [30, 0]);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 9900,
        backgroundColor: '#161513',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        opacity,
        fontFamily: '"IBM Plex Sans", sans-serif',
      }}
    >
      {/* Background Accent Gradients */}
      <div
        style={{
          position: 'absolute',
          width: '700px',
          height: '700px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(143, 191, 168, 0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          transform: `translateY(${translateY}px) scale(${scale})`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          padding: '48px 64px',
          borderRadius: '24px',
          backgroundColor: '#1c1a18',
          border: '1px solid #34302b',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.5)',
          maxWidth: '820px',
          width: '90%',
          position: 'relative',
        }}
      >
        {/* Project Tag */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 14px',
            borderRadius: '999px',
            backgroundColor: 'rgba(143, 191, 168, 0.12)',
            border: '1px solid rgba(143, 191, 168, 0.3)',
            marginBottom: '20px',
          }}
        >
          <div
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: '#8fbfa8',
            }}
          />
          <span
            style={{
              fontSize: '12px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: '#8fbfa8',
            }}
          >
            Dashboard de Avaliações da Steam
          </span>
        </div>

        {/* Name */}
        <h1
          style={{
            margin: '0 0 8px 0',
            fontSize: '44px',
            fontWeight: 600,
            color: '#efe9de',
            letterSpacing: '-0.02em',
          }}
        >
          Emerson Amaro
        </h1>

        <p
          style={{
            margin: '0 0 28px 0',
            fontSize: '18px',
            color: '#aaa398',
            fontWeight: 400,
          }}
        >
          Engenharia de Software & Análise de Dados
        </p>

        {/* GitHub Link Box */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '14px 24px',
            borderRadius: '12px',
            backgroundColor: '#262421',
            border: '1px solid #34302b',
            marginBottom: '32px',
          }}
        >
          {/* GitHub SVG */}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="#efe9de">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
          </svg>
          <span
            style={{
              fontSize: '16px',
              fontFamily: '"IBM Plex Mono", monospace',
              color: '#8fbfa8',
              fontWeight: 500,
            }}
          >
            github.com/EmersonPalatti/game-review-dashboard
          </span>
        </div>

        {/* Stack Highlights */}
        <div
          style={{
            display: 'flex',
            gap: '10px',
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          {['Astro', 'TypeScript', 'Apache ECharts', 'Nanostores', 'FastAPI', 'SQLite'].map(
            (tech) => (
              <span
                key={tech}
                style={{
                  fontSize: '12px',
                  fontFamily: '"IBM Plex Mono", monospace',
                  color: '#aaa398',
                  backgroundColor: '#161513',
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: '1px solid #34302b',
                }}
              >
                {tech}
              </span>
            )
          )}
        </div>
      </div>
    </div>
  );
};

