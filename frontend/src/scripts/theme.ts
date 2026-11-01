import { THEME_KEY, THEME_REVEAL_MS } from '../lib/constants';

export function currentTheme(): 'dark' | 'light' {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function applyTheme(
  theme: 'dark' | 'light',
  themeToggle?: HTMLButtonElement,
  onRepaintCharts?: () => void,
): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.style.colorScheme = theme;
  localStorage.setItem(THEME_KEY, theme);
  if (themeToggle) {
    themeToggle.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
  }
  if (onRepaintCharts) {
    onRepaintCharts();
  }
}

let themeReveal: Animation | null = null;

export function themeOrigin(themeToggle: HTMLButtonElement): { x: number; y: number } {
  const icons = themeToggle.querySelectorAll('.when-light, .when-dark');
  for (const icon of icons) {
    if (!(icon instanceof HTMLElement)) continue;
    const box = icon.getBoundingClientRect();
    if (box.width > 0 && box.height > 0) {
      return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    }
  }
  const box = themeToggle.getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
}

export function circleClip(
  x: number,
  y: number,
  radius: number,
  width: number,
  height: number,
): [string, string] {
  const point = `${(x / width) * 100}% ${(y / height) * 100}%`;
  // circle() percentages resolve against hypot(w, h) / sqrt(2), not px.
  // Px clip-paths land off-center on the first transition at fractional display scale.
  const end = (radius / (Math.hypot(width, height) / Math.SQRT2)) * 100;
  return [`circle(0% at ${point})`, `circle(${end}% at ${point})`];
}

export function revealTheme(
  themeToggle: HTMLButtonElement,
  onRepaintCharts: () => void,
  targetTheme?: 'dark' | 'light',
): void {
  const next = targetTheme ?? (currentTheme() === 'dark' ? 'light' : 'dark');
  const root = document.documentElement;
  if (root.dataset.themeReveal === 'active') return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced || typeof document.startViewTransition !== 'function') {
    applyTheme(next, themeToggle, onRepaintCharts);
    return;
  }

  const width = window.innerWidth;
  const height = window.innerHeight;
  const origin = themeOrigin(themeToggle);
  const radius = Math.hypot(
    Math.max(origin.x, width - origin.x),
    Math.max(origin.y, height - origin.y),
  );
  const clipPath = circleClip(origin.x, origin.y, radius, width, height);

  root.dataset.themeReveal = 'active';
  root.style.setProperty('--theme-reveal-duration', `${THEME_REVEAL_MS}ms`);
  root.style.setProperty('--theme-reveal-clip', clipPath[0]);

  const cleanup = (): void => {
    delete root.dataset.themeReveal;
    root.style.removeProperty('--theme-reveal-duration');
    root.style.removeProperty('--theme-reveal-clip');
    themeReveal?.cancel();
    themeReveal = null;
  };

  let transition: ViewTransition;
  try {
    transition = document.startViewTransition(() => {
      applyTheme(next, themeToggle, onRepaintCharts);
    });
    (window as unknown as { __themeTransition?: ViewTransition }).__themeTransition = transition;
  } catch {
    cleanup();
    if (currentTheme() !== next) applyTheme(next, themeToggle, onRepaintCharts);
    return;
  }

  transition.finished
    .finally(() => {
      cleanup();
      delete (window as unknown as { __themeTransition?: unknown }).__themeTransition;
    })
    .catch(() => {});
  transition.ready
    .then(() => {
      themeReveal = root.animate(
        { clipPath },
        {
          duration: THEME_REVEAL_MS,
          easing: 'ease-in-out',
          fill: 'forwards',
          pseudoElement: '::view-transition-new(root)',
        },
      );
    })
    .catch(() => {});
}

export function setupTheme(themeToggle: HTMLButtonElement, onRepaintCharts: () => void): void {
  applyTheme(currentTheme(), themeToggle);
  themeToggle.addEventListener('click', () => {
    revealTheme(themeToggle, onRepaintCharts);
  });
}
