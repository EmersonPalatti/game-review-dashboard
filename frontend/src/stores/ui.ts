import { atom } from 'nanostores';

// Estado de interface que atravessa ilhas e o script da página. Cada atom tem um único escritor
// declarado abaixo; os demais só leem. Atributos no DOM, quando existem, servem apenas ao CSS.

/**
 * SteamBot acoplado ao lado do dashboard: painel aberto (e não fechando) em viewport >= 1440px.
 * Escritor: ChatIsland, que também espelha o valor em `data-chat-dock` no <html> para o CSS.
 */
export const chatDocked = atom(false);

/**
 * Gaveta de filtros aberta no mobile (< 768px). Escritores: dashboard.ts (botões do shell, Esc,
 * atalho "/") e ilhas que precisem fechá-la. O dashboard.ts aplica classe, `inert` e foco.
 */
export const mobileSidebarOpen = atom(false);
