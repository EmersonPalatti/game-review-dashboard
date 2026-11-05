export type FilterChip = {
  label: string;
  value: string;
  clear: () => void;
};

export function renderFilterChips(
  container: HTMLElement,
  chips: FilterChip[],
  onResetAll: () => void,
): void {
  container.replaceChildren();

  if (chips.length === 0) {
    const empty = document.createElement('span');
    empty.className = 'meta';
    empty.textContent = 'Base completa · nenhum filtro ativo';
    container.append(empty);
    return;
  }

  for (const chip of chips) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'filter-chip';
    btn.setAttribute('aria-label', `Remover filtro ${chip.label}: ${chip.value}`);

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

export function rankRow(
  key: string,
  index: number,
  name: string,
  value: string,
  widthPercent: number,
  options: { title: string; selected: boolean; ariaLabel: string; onSelect: () => void },
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

  const track = document.createElement('div');
  track.className = 'rank-track';
  track.setAttribute('aria-hidden', 'true');

  const fill = document.createElement('div');
  fill.className = 'rank-fill';

  line.append(label, number);
  track.append(fill);
  btn.append(line, track);
  row.append(btn);

  btn.addEventListener('click', () => {
    options.onSelect();
  });

  const targetScale = Math.max(0, Math.min(1, widthPercent / 100));
  const fromScale = previousRankScales.get(key) ?? 0;
  previousRankScales.set(key, targetScale);
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
