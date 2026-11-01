import { formatInteger } from '../lib/format';

export type ComboOption = { value: string; label: string; count?: number };

export function fold(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

export class SearchCombo {
  private options: ComboOption[] = [];
  private committed: string;
  private query = '';
  private active = 0;
  private open = false;
  private blurTimer = 0;
  private navigated = false;
  private readonly root: HTMLElement;
  private readonly toggle: HTMLButtonElement;
  private readonly icon: SVGSVGElement;
  private readonly onReflow = () => {
    if (this.open) this.placeMenu();
  };

  constructor(
    private readonly input: HTMLInputElement,
    private readonly menu: HTMLUListElement,
    private readonly onCommit: (value: string) => void,
    private readonly emptyOption: ComboOption = { value: '', label: 'Todos' },
  ) {
    const root = input.parentElement;
    if (!(root instanceof HTMLElement)) {
      throw new Error(`Combo sem contêiner: ${input.id}`);
    }
    this.root = root;
    const toggle = root.querySelector(':scope > .combo-toggle');
    const icon = toggle?.querySelector(':scope > .combo-toggle-icon');
    if (!(toggle instanceof HTMLButtonElement) || !(icon instanceof SVGSVGElement)) {
      throw new Error(`Combo sem botão: ${input.id}`);
    }
    this.toggle = toggle;
    this.icon = icon;
    this.toggle.setAttribute('aria-controls', menu.id);

    this.committed = emptyOption.value;
    input.placeholder = emptyOption.label;
    input.addEventListener('focus', () => {
      this.navigated = false;
      this.query = '';
      this.input.select();
      this.openMenu(true);
    });
    input.addEventListener('input', () => {
      this.navigated = true;
      this.query = this.input.value;
      this.openMenu(true);
    });
    input.addEventListener('keydown', (event) => {
      this.onKey(event);
    });
    input.addEventListener('blur', () => {
      this.blurTimer = window.setTimeout(() => this.finishEditing(), 150);
    });
    this.toggle.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      window.clearTimeout(this.blurTimer);
      this.onToggle();
    });
    this.toggle.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    menu.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      window.clearTimeout(this.blurTimer);
    });
    menu.addEventListener('click', (event) => {
      const option = event.target instanceof Element ? event.target.closest('[data-value]') : null;
      if (!(option instanceof HTMLElement)) return;
      this.commit(option.dataset.value ?? this.emptyOption.value);
      this.input.blur();
    });
    window.addEventListener('resize', this.onReflow);
    document.addEventListener('scroll', this.onReflow, true);
    const box = new ResizeObserver(() => {
      if (this.open) this.placeMenu();
    });
    box.observe(this.input);
  }

  setOptions(options: ComboOption[]): void {
    this.options = options;
    if (this.open) this.paint(false);
    else if (document.activeElement !== this.input) this.showCommitted();
  }

  setCommitted(value: string): void {
    this.committed = value;
    if (document.activeElement === this.input && this.open) return;
    this.showCommitted();
  }

  private filtered(): ComboOption[] {
    const query = fold(this.query.trim());
    const matches =
      query === ''
        ? this.options
        : this.options.filter((item) => fold(item.label).includes(query) || fold(item.value).includes(query));
    const emptyMatches = query === '' || fold(this.emptyOption.label).includes(query);
    return emptyMatches ? [this.emptyOption, ...matches] : matches;
  }

  private showCommitted(): void {
    if (this.committed === this.emptyOption.value) {
      this.input.value = '';
      return;
    }
    const match = this.options.find((item) => item.value === this.committed);
    this.input.value = match?.label ?? '';
  }

  private placeMenu(): void {
    const rect = this.input.getBoundingClientRect();
    const height = Math.min(this.menu.scrollHeight, 240);
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const openUp = spaceBelow < height && rect.top > spaceBelow;
    this.setDirection(openUp);
    this.menu.style.position = 'fixed';
    this.menu.style.left = `${rect.left}px`;
    this.menu.style.width = `${rect.width}px`;
    this.menu.style.right = 'auto';
    if (openUp) {
      this.menu.style.top = 'auto';
      this.menu.style.bottom = `${window.innerHeight - rect.top + 4}px`;
    } else {
      this.menu.style.bottom = 'auto';
      this.menu.style.top = `${rect.bottom + 4}px`;
    }
  }

  private setDirection(openUp: boolean): void {
    const wasUp = this.root.classList.contains('is-up');
    if (wasUp === openUp) return;
    if (this.open) this.icon.style.transition = 'none';
    this.root.classList.toggle('is-up', openUp);
    if (this.open) {
      void this.icon.getBoundingClientRect();
      this.icon.style.transition = '';
    }
  }

  private openMenu(reset: boolean): void {
    const opening = !this.open;
    this.paint(reset);
    this.placeMenu();
    if (opening) void this.menu.offsetHeight;
    this.open = true;
    this.menu.classList.add('is-open');
    this.root.classList.add('is-open');
    this.input.setAttribute('aria-expanded', 'true');
    this.toggle.setAttribute('aria-expanded', 'true');
    this.toggle.setAttribute('aria-label', 'Ocultar opções');
  }

  private close(): void {
    this.open = false;
    this.menu.classList.remove('is-open');
    this.root.classList.remove('is-open');
    this.input.setAttribute('aria-expanded', 'false');
    this.input.removeAttribute('aria-activedescendant');
    this.toggle.setAttribute('aria-expanded', 'false');
    this.toggle.setAttribute('aria-label', 'Mostrar opções');
  }

  private onToggle(): void {
    if (this.open) {
      this.showCommitted();
      this.close();
      this.input.blur();
      return;
    }
    this.navigated = false;
    this.query = '';
    const alreadyFocused = document.activeElement === this.input;
    this.input.focus();
    if (alreadyFocused) this.openMenu(true);
  }

  private paint(reset: boolean): void {
    const items = this.filtered();
    if (reset) {
      const selected = items.findIndex((item) => item.value === this.committed);
      this.active = selected >= 0 ? selected : 0;
    }
    if (this.active >= items.length) this.active = Math.max(0, items.length - 1);
    this.menu.replaceChildren();

    if (items.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'combo-empty';
      empty.textContent = 'Nenhum resultado';
      this.menu.append(empty);
      this.input.removeAttribute('aria-activedescendant');
      return;
    }

    items.forEach((item, index) => {
      const option = document.createElement('li');
      option.className = index === this.active ? 'combo-option is-active' : 'combo-option';
      option.id = `${this.input.id}-opt-${index}`;
      option.dataset.value = item.value;
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', item.value === this.committed ? 'true' : 'false');
      option.title = item.label;

      const labelSpan = document.createElement('span');
      labelSpan.className = 'combo-option-label';
      labelSpan.textContent = item.label;
      option.append(labelSpan);
      if (typeof item.count === 'number') {
        const countSpan = document.createElement('span');
        countSpan.className = 'combo-option-count';
        countSpan.textContent = formatInteger(item.count);
        option.append(countSpan);
      }

      this.menu.append(option);
    });

    const current = this.menu.children.item(this.active);
    if (current instanceof HTMLElement) {
      this.input.setAttribute('aria-activedescendant', current.id);
      const menuRect = this.menu.getBoundingClientRect();
      const optionRect = current.getBoundingClientRect();
      if (optionRect.bottom > menuRect.bottom) {
        this.menu.scrollTop += optionRect.bottom - menuRect.bottom;
      } else if (optionRect.top < menuRect.top) {
        this.menu.scrollTop -= menuRect.top - optionRect.top;
      }
    }
  }

  private commit(value: string): void {
    const changed = value !== this.committed;
    this.committed = value;
    this.showCommitted();
    this.close();
    if (changed) this.onCommit(value);
  }

  private finishEditing(): void {
    if (!this.open && document.activeElement !== this.input) {
      this.showCommitted();
      return;
    }
    if (this.open && this.navigated) {
      const items = this.filtered();
      const picked = items[this.active];
      if (picked) {
        this.commit(picked.value);
        return;
      }
    }
    const typed = this.input.value.trim();
    if (typed === '' || fold(typed) === fold(this.emptyOption.label)) {
      this.commit(this.emptyOption.value);
      return;
    }
    const match = this.options.find((item) => fold(item.label) === fold(typed));
    if (match) this.commit(match.value);
    else {
      this.showCommitted();
      this.close();
    }
  }

  private onKey(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!this.open) this.openMenu(true);
      const count = this.filtered().length;
      if (count === 0) return;
      this.navigated = true;
      this.active += event.key === 'ArrowDown' ? 1 : -1;
      if (this.active < 0) this.active = count - 1;
      if (this.active >= count) this.active = 0;
      this.paint(false);
      return;
    }
    if (event.key === 'Tab' && this.open) {
      window.clearTimeout(this.blurTimer);
      if (this.navigated) {
        const items = this.filtered();
        const picked = items[this.active];
        if (picked) {
          this.commit(picked.value);
          return;
        }
      }
      this.showCommitted();
      this.close();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const items = this.filtered();
      const picked = items[this.active];
      if (this.open && picked) this.commit(picked.value);
      else this.finishEditing();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      this.showCommitted();
      this.close();
    }
  }
}
