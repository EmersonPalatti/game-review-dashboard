export type FilterChip = {
  label: string;
  value: string;
  clear: () => void;
};

function cloneTemplate<T extends HTMLElement>(templateId: string): T | null {
  const tpl = document.getElementById(templateId);
  if (!(tpl instanceof HTMLTemplateElement)) return null;
  const clone = tpl.content.firstElementChild;
  if (!(clone instanceof HTMLElement)) return null;
  return clone.cloneNode(true) as T;
}

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
    let btn = cloneTemplate<HTMLButtonElement>('tpl-filter-chip');
    if (btn) {
      btn.setAttribute('aria-label', `Remover filtro ${chip.label}: ${chip.value}`);
      const labelEl = btn.querySelector('[data-slot="label"]');
      if (labelEl) labelEl.textContent = `${chip.label}:`;
      const valueEl = btn.querySelector('[data-slot="value"]');
      if (valueEl) valueEl.textContent = chip.value;
      btn.addEventListener('click', () => {
        chip.clear();
      });
    } else {
      btn = document.createElement('button');
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
    }
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
  let row = cloneTemplate<HTMLLIElement>('tpl-rank-row');
  let fill: HTMLElement | null = null;

  if (row) {
    row.className = options.selected ? 'rank-row is-selected' : 'rank-row';
    row.title = options.title;
    row.tabIndex = 0;
    row.setAttribute('role', 'button');
    row.setAttribute('aria-pressed', options.selected ? 'true' : 'false');
    row.setAttribute('aria-label', options.ariaLabel);

    const nameEl = row.querySelector('[data-slot="name"]');
    if (nameEl) nameEl.textContent = name;
    const valueEl = row.querySelector('[data-slot="value"]');
    if (valueEl) valueEl.textContent = value;
    fill = row.querySelector<HTMLElement>('[data-slot="fill"]');
  } else {
    row = document.createElement('li');
    row.className = options.selected ? 'rank-row is-selected' : 'rank-row';
    row.title = options.title;
    row.tabIndex = 0;
    row.setAttribute('role', 'button');
    row.setAttribute('aria-pressed', options.selected ? 'true' : 'false');
    row.setAttribute('aria-label', options.ariaLabel);

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

    fill = document.createElement('div');
    fill.className = 'rank-fill';

    line.append(label, number);
    track.append(fill);
    row.append(line, track);
  }

  row.addEventListener('click', () => {
    options.onSelect();
  });
  row.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      options.onSelect();
    }
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
