import type { ReviewItem } from '../lib/api';
import { PLACEHOLDER } from '../lib/constants';
import { formatDate, formatHours, formatInteger, languageLabel } from '../lib/format';

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

function buildRecommendationContent(recommended: boolean): HTMLElement {
  const mark = document.createElement('span');
  if (recommended) {
    mark.className = 'sim';
    const rule = document.createElement('span');
    rule.className = 'sim-rule';
    rule.setAttribute('aria-hidden', 'true');
    mark.append(rule, document.createTextNode('Sim'));
  } else {
    mark.className = 'nao';
    mark.textContent = 'Não';
  }
  return mark;
}

function buildBadges(item: ReviewItem): HTMLElement[] {
  const badges: HTMLElement[] = [];

  const dateBadge = document.createElement('span');
  dateBadge.className = 'review-badge';
  dateBadge.textContent = formatDate(item.created_at);
  badges.push(dateBadge);

  if (item.early_access) {
    const badge = document.createElement('span');
    badge.className = 'review-badge is-accent';
    badge.textContent = 'Acesso antecipado';
    badges.push(badge);
  }

  if (item.received_for_free) {
    const badge = document.createElement('span');
    badge.className = 'review-badge';
    badge.textContent = 'Recebido de graça';
    badges.push(badge);
  }

  if (!item.steam_purchase) {
    const badge = document.createElement('span');
    badge.className = 'review-badge';
    badge.textContent = 'Chave externa';
    badges.push(badge);
  }

  if (item.votes_funny > 0) {
    const badge = document.createElement('span');
    badge.className = 'review-badge';
    badge.textContent = `${formatInteger(item.votes_funny)} engraçados`;
    badges.push(badge);
  }

  if (item.comment_count > 0) {
    const badge = document.createElement('span');
    badge.className = 'review-badge';
    badge.textContent = `${formatInteger(item.comment_count)} coment.`;
    badges.push(badge);
  }

  return badges;
}

export function renderReviewRow(item: ReviewItem): HTMLTableRowElement {
  const hours = item.playtime_at_review_hours;
  const hoursText = hours === null || !Number.isFinite(hours) ? PLACEHOLDER : formatHours(hours);
  const language = languageLabel(item.language);

  let row = cloneTemplate<HTMLTableRowElement>('tpl-review-row');

  if (row) {
    row.className = 'review-row';
    row.tabIndex = 0;
    row.setAttribute('aria-expanded', 'false');

    const gameEl = row.querySelector('[data-slot="game"]');
    if (gameEl) {
      gameEl.textContent = item.app_name;
      gameEl.setAttribute('title', item.app_name);
    }

    const langEl = row.querySelector('[data-slot="language"]');
    if (langEl) {
      langEl.textContent = language;
      langEl.setAttribute('title', language);
    }

    const recEl = row.querySelector('[data-slot="recommendation"]');
    if (recEl) {
      recEl.replaceChildren(buildRecommendationContent(item.recommended));
    }

    const hoursEl = row.querySelector('[data-slot="hours"]');
    if (hoursEl) {
      hoursEl.textContent = hoursText;
    }

    const helpfulEl = row.querySelector('[data-slot="helpful"]');
    if (helpfulEl) {
      helpfulEl.textContent = formatInteger(item.votes_helpful);
    }

    const excerptEl = row.querySelector('[data-slot="excerpt"]');
    if (excerptEl) {
      excerptEl.textContent = item.excerpt || 'Sem texto na avaliação.';
    }

    const badgesEl = row.querySelector('[data-slot="badges"]');
    if (badgesEl) {
      badgesEl.replaceChildren(...buildBadges(item));
    }
  } else {
    // Fallback imperativo
    row = document.createElement('tr');
    row.className = 'review-row';
    row.tabIndex = 0;
    row.setAttribute('aria-expanded', 'false');

    const gameTd = document.createElement('td');
    gameTd.textContent = item.app_name;
    gameTd.title = item.app_name;

    const langTd = document.createElement('td');
    langTd.textContent = language;
    langTd.title = language;

    const recTd = document.createElement('td');
    recTd.append(buildRecommendationContent(item.recommended));

    const hoursTd = document.createElement('td');
    hoursTd.textContent = hoursText;

    const helpfulTd = document.createElement('td');
    helpfulTd.textContent = formatInteger(item.votes_helpful);

    const excerptTd = document.createElement('td');
    const excerptCell = document.createElement('div');
    excerptCell.className = 'excerpt-cell';

    const excerptLine = document.createElement('div');
    excerptLine.className = 'excerpt-line';

    const chevron = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    chevron.setAttribute('viewBox', '0 0 24 24');
    chevron.setAttribute('fill', 'none');
    chevron.setAttribute('stroke', 'currentColor');
    chevron.setAttribute('stroke-width', '2');
    chevron.setAttribute('stroke-linecap', 'round');
    chevron.setAttribute('stroke-linejoin', 'round');
    chevron.setAttribute('aria-hidden', 'true');
    chevron.classList.add('excerpt-chevron');
    const chevronPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    chevronPath.setAttribute('d', 'm9 18 6-6-6-6');
    chevron.append(chevronPath);

    const excerptText = document.createElement('div');
    excerptText.className = 'excerpt-text';
    excerptText.textContent = item.excerpt || 'Sem texto na avaliação.';

    excerptLine.append(chevron, excerptText);
    excerptCell.append(excerptLine);

    const badgesContainer = document.createElement('div');
    badgesContainer.className = 'review-badges';
    badgesContainer.append(...buildBadges(item));
    excerptCell.append(badgesContainer);
    excerptTd.append(excerptCell);

    row.append(gameTd, langTd, recTd, hoursTd, helpfulTd, excerptTd);
  }

  const toggleRow = (): void => {
    const expanded = row.classList.toggle('is-expanded');
    row.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  };
  row.addEventListener('click', toggleRow);
  row.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleRow();
    }
  });

  return row;
}

export function renderEmptyReviewRow(onClear: () => void): HTMLTableRowElement {
  const row = cloneTemplate<HTMLTableRowElement>('tpl-review-empty');
  if (row) {
    const clearBtn = row.querySelector('[data-slot="clear"]');
    if (clearBtn) {
      clearBtn.addEventListener('click', onClear);
    }
    return row;
  }

  const fallbackRow = document.createElement('tr');
  const empty = document.createElement('td');
  empty.colSpan = 6;
  empty.className = 'empty-cell';

  const wrap = document.createElement('div');
  wrap.className = 'empty-state';

  const msg = document.createElement('p');
  msg.textContent = 'Nenhuma avaliação com esses filtros.';

  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'btn btn-secondary btn-small';
  clearBtn.textContent = 'Limpar filtros';
  clearBtn.addEventListener('click', onClear);

  wrap.append(msg, clearBtn);
  empty.append(wrap);
  fallbackRow.append(empty);
  return fallbackRow;
}
