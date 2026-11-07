export type FilterChip = {
  label: string;
  value: string;
  clear: () => void;
};

// Rastreia as chaves dos chips da renderização anterior para animar apenas novos filtros.
const previousChipKeys = new Set<string>();
let isInitialRender = true;

export function renderFilterChips(
  container: HTMLElement,
  chips: FilterChip[],
  onResetAll: () => void,
): void {
  container.replaceChildren();

  const currentKeys = new Set<string>();

  if (chips.length === 0) {
    previousChipKeys.clear();
    isInitialRender = false;
    const empty = document.createElement('span');
    empty.className = 'meta';
    empty.textContent = 'Base completa · nenhum filtro ativo';
    container.append(empty);
    return;
  }

  // Na primeira renderização (ex: carga com filtros da URL), não anima.
  const isFirstRender = isInitialRender;
  isInitialRender = false;

  for (const chip of chips) {
    const key = `${chip.label}:${chip.value}`;
    currentKeys.add(key);

    const isEntering = !isFirstRender && !previousChipKeys.has(key);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = isEntering ? 'filter-chip is-entering' : 'filter-chip';
    btn.setAttribute('aria-label', `Remover filtro ${chip.label}: ${chip.value}`);

    if (isEntering) {
      // Remove a classe ao término da animação para não repetir.
      btn.addEventListener(
        'animationend',
        () => {
          btn.classList.remove('is-entering');
        },
        { once: true },
      );
    }

    const labelSpan = document.createElement('span');
    labelSpan.className = 'filter-chip-label';
    labelSpan.textContent = `${chip.label}:`;

    const valueSpan = document.createElement('span');
    valueSpan.className = 'filter-chip-value';
    valueSpan.textContent = chip.value;

    const removeSpan = document.createElement('span');
    removeSpan.className = 'filter-chip-remove';
    removeSpan.setAttribute('aria-hidden', 'true');
    removeSpan.textContent = '×';

    btn.append(labelSpan, valueSpan, removeSpan);
    btn.addEventListener('click', () => {
      chip.clear();
    });
    container.append(btn);
  }

  // Atualiza o conjunto de chaves ativas para a próxima execução.
  previousChipKeys.clear();
  for (const key of currentKeys) {
    previousChipKeys.add(key);
  }

  if (chips.length >= 2) {
    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'filter-chip is-reset';
    resetBtn.textContent = 'Limpar todos';
    resetBtn.addEventListener('click', () => {
      onResetAll();
    });
    container.append(resetBtn);
  }
}

const previousRankScales = new Map<string, number>();

export type RankRowOptions = {
  title: string;
  selected: boolean;
  ariaLabel: string;
  onSelect: () => void;
  variant?: 'default' | 'diverging';
  signedValue?: number;
};

export function rankRow(
  key: string,
  index: number,
  name: string,
  value: string,
  widthPercent: number,
  options: RankRowOptions,
): HTMLLIElement {
  const row = document.createElement('li');
  row.className = 'rank-item';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = options.selected ? 'rank-row is-selected w-full text-left' : 'rank-row w-full text-left';
  btn.title = options.title;
  btn.setAttribute('aria-pressed', options.selected ? 'true' : 'false');
  btn.setAttribute('aria-label', options.ariaLabel);

  const line = document.createElement('div');
  line.className = 'rank-line';

  const label = document.createElement('span');
  label.className = 'min-w-0 flex-1 truncate';
  label.textContent = name;

  const number = document.createElement('span');
  number.className = 'rank-value';
  number.textContent = value;

  const isDiverging = options.variant === 'diverging';
  const track = document.createElement('div');
  track.className = isDiverging ? 'rank-track rank-track-diverging' : 'rank-track';
  track.setAttribute('aria-hidden', 'true');

  const fill = document.createElement('div');

  let targetScale = 0;
  let fromScale = 0;

  if (isDiverging) {
    const signed = options.signedValue ?? 0;
    const prevSigned = previousRankScales.get(key) ?? 0;
    previousRankScales.set(key, signed);

    if (signed > 0) {
      fill.className = 'rank-fill rank-fill-positive';
      targetScale = Math.min(1, signed);
      fromScale = prevSigned > 0 ? Math.min(1, prevSigned) : 0;
    } else if (signed < 0) {
      fill.className = 'rank-fill rank-fill-negative';
      targetScale = Math.min(1, Math.abs(signed));
      fromScale = prevSigned < 0 ? Math.min(1, Math.abs(prevSigned)) : 0;
    } else {
      fill.className = 'rank-fill';
      targetScale = 0;
      fromScale = 0;
    }
  } else {
    fill.className = 'rank-fill';
    targetScale = Math.max(0, Math.min(1, widthPercent / 100));
    fromScale = previousRankScales.get(key) ?? 0;
    previousRankScales.set(key, targetScale);
  }

  line.append(label, number);
  track.append(fill);
  btn.append(line, track);
  row.append(btn);

  btn.addEventListener('click', () => {
    options.onSelect();
  });

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (fill) {
    if (reduced || Math.abs(fromScale - targetScale) < 1e-4) {
      fill.style.transform = `scaleX(${targetScale})`;
    } else {
      fill.style.transform = `scaleX(${fromScale})`;
      fill.style.transitionDelay = `${Math.min(index * 20, 140)}ms`;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (fill) fill.style.transform = `scaleX(${targetScale})`;
        });
      });
    }
  }

  return row;
}
