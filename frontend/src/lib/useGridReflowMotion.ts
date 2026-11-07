import { useEffect, type RefObject } from 'react';

type Rect = { left: number; top: number };

function columnCount(grid: HTMLElement): number {
  return getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length;
}

function readToken(name: string, fallback: number): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const ms = Number.parseFloat(raw);
  if (Number.isNaN(ms)) return fallback;
  return raw.endsWith('ms') ? ms : ms * 1000;
}

/**
 * Quando a grade muda de número de colunas (ex.: o SteamBot encaixa e o container cruza 880px),
 * cada card desliza da posição anterior até a nova (FLIP), em vez de saltar centenas de pixels.
 * Só translada: largura e canvas já acompanham o container quadro a quadro.
 */
export function useGridReflowMotion(gridRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid || typeof ResizeObserver === 'undefined') return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const items = () => Array.from(grid.children) as HTMLElement[];
    const measure = () =>
      new Map<HTMLElement, Rect>(
        items().map((el) => {
          const r = el.getBoundingClientRect();
          return [el, { left: r.left + window.scrollX, top: r.top + window.scrollY }];
        }),
      );

    let columns = columnCount(grid);
    let last = measure();

    const observer = new ResizeObserver(() => {
      const nextColumns = columnCount(grid);
      const next = measure();
      if (nextColumns !== columns && !reduced.matches) {
        const duration = readToken('--settle', 340);
        const easing =
          getComputedStyle(document.documentElement).getPropertyValue('--ease').trim() || 'ease-out';
        for (const [el, rect] of next) {
          const prev = last.get(el);
          if (!prev) continue;
          const dx = prev.left - rect.left;
          const dy = prev.top - rect.top;
          if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
          el.animate(
            [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }],
            { duration, easing },
          );
        }
      }
      columns = nextColumns;
      last = next;
    });

    observer.observe(grid);
    return () => observer.disconnect();
  }, [gridRef]);
}
