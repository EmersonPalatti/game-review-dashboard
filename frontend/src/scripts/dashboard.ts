import {
  filters,
  readFiltersFromSearch,
  resetFilters,
  reviewSort,
  writeFiltersToSearch,
} from '../stores/filters';
import { mobileSidebarOpen } from '../stores/ui';
import { isUrlSyncSuppressed, suppressUrlSyncDuring } from '../stores/urlSync';
import { setupTheme } from './theme';

function requireElement<T extends Element>(id: string, ctor: new () => T): T {
  const element = document.getElementById(id);
  if (!(element instanceof ctor)) {
    throw new Error(`Elemento não encontrado: ${id}`);
  }
  return element;
}

const main = requireElement('dashboard-main', HTMLElement);
const themeButton = requireElement('theme-toggle', HTMLButtonElement);
const sidebarPanel = requireElement('app-sidebar', HTMLElement);
const sidebarOpenButton = requireElement('sidebar-open', HTMLButtonElement);
const sidebarCloseButton = requireElement('sidebar-close', HTMLButtonElement);
const sidebarQuery = window.matchMedia('(max-width: 767px)');

function syncMobileSidebar(): void {
  const open = mobileSidebarOpen.get();
  sidebarPanel.inert = sidebarQuery.matches && !open;
  main.inert = sidebarQuery.matches && open;
  sidebarOpenButton.setAttribute('aria-expanded', open ? 'true' : 'false');
}

function setMobileSidebar(open: boolean): void {
  mobileSidebarOpen.set(open);
}

// Único ponto que aplica a gaveta ao DOM: o nanostores só chama este listener quando o valor muda.
mobileSidebarOpen.listen((open, wasOpen) => {
  sidebarPanel.classList.toggle('is-open', open);
  syncMobileSidebar();
  if (sidebarQuery.matches) {
    if (open && !wasOpen) sidebarCloseButton.focus();
    else if (!open && wasOpen) sidebarOpenButton.focus();
  }
});

sidebarOpenButton.addEventListener('click', () => {
  setMobileSidebar(!mobileSidebarOpen.get());
});
sidebarCloseButton.addEventListener('click', () => {
  setMobileSidebar(false);
});
sidebarQuery.addEventListener('change', () => {
  if (!sidebarQuery.matches) setMobileSidebar(false);
  syncMobileSidebar();
});
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || !mobileSidebarOpen.get()) return;
  if (sidebarPanel.querySelector('.combo-menu.is-open')) return;
  setMobileSidebar(false);
});
syncMobileSidebar();

function syncUrl(replace = false): void {
  if (isUrlSyncSuppressed()) return;
  const search = writeFiltersToSearch(filters.get(), reviewSort.get());
  const nextUrl = `${window.location.pathname}${search}${window.location.hash}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (nextUrl !== currentUrl) {
    if (replace) {
      window.history.replaceState(null, '', nextUrl);
    } else {
      window.history.pushState(null, '', nextUrl);
    }
  }
}

function bindControls(): void {
  document.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (
      event.target instanceof HTMLElement &&
      (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA' || event.target.isContentEditable)
    ) {
      return;
    }
    if (event.key === '/') {
      event.preventDefault();
      if (sidebarQuery.matches && !mobileSidebarOpen.get()) {
        setMobileSidebar(true);
      }
      const appInput = document.getElementById('filter-app');
      if (appInput instanceof HTMLInputElement) {
        appInput.focus();
      }
      return;
    }
    if (event.shiftKey && event.key.toLowerCase() === 'x') {
      event.preventDefault();
      resetFilters();
    }
  });
}

function init(): void {
  setupTheme(themeButton);
  bindControls();

  const initial = readFiltersFromSearch(window.location.search);
  filters.set(initial.filters);
  reviewSort.set(initial.sort);

  filters.listen(() => {
    syncUrl();
  });

  reviewSort.listen(() => {
    syncUrl();
  });

  window.addEventListener('popstate', () => {
    suppressUrlSyncDuring(() => {
      const next = readFiltersFromSearch(window.location.search);
      filters.set(next.filters);
      reviewSort.set(next.sort);
    });
  });

  syncUrl(true);
}

init();
