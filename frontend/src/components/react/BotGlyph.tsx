type BotGlyphProps = {
  className?: string;
  /** Muda a cada filtro aplicado; a troca remonta os olhos e reinicia a olhada. 0 = sem olhada. */
  glanceKey?: number;
};

/**
 * Robô do SteamBot desenhado à mão (mesma geometria e traço do Lucide `Bot`) para que olhos e antena
 * sejam peças animáveis. O movimento vive no CSS (`.bot-glyph` em global.css):
 * - olhada: os olhos vão até o painel e piscam quando um filtro muda;
 * - hover/foco do botão: olhos sorrindo e antena balançando;
 * - pensando (`.is-thinking` no avatar): olhos varrendo de um lado a outro.
 */
export function BotGlyph({ className = '', glanceKey = 0 }: BotGlyphProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`bot-glyph ${className}`.trim()}
      aria-hidden="true"
    >
      <path className="bot-antenna" d="M12 8V4H8" />
      <rect width="16" height="12" x="4" y="8" rx="2" />
      <path d="M2 14h2" />
      <path d="M20 14h2" />
      <g key={glanceKey} className={glanceKey ? 'bot-eyes is-glancing' : 'bot-eyes'}>
        <g className="bot-eyes-open">
          <path d="M9 13v2" />
          <path d="M15 13v2" />
        </g>
        <g className="bot-eyes-happy">
          <path d="M7.8 14.6q1.2-1.8 2.4 0" />
          <path d="M13.8 14.6q1.2-1.8 2.4 0" />
        </g>
      </g>
    </svg>
  );
}
