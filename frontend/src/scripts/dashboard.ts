import { queryClient } from '../lib/queryClient';
import {
  filters,
  readFiltersFromSearch,
  reviewSort,
  writeFiltersToSearch,
} from '../stores/filters';
import { isUrlSyncSuppressed, suppressUrlSyncDuring } from '../stores/urlSync';
import { repaintCharts } from './charts';
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
const retryButton = requireElement('retry', HTMLButtonElement);
const loadError = requireElement('load-error', HTMLElement);
const loadErrorDetail = requireElement('load-error-detail', HTMLElement);
void loadErrorDetail;

function syncMobileSidebar(): void {
  const open = sidebarPanel.classList.contains('is-open');
  sidebarPanel.inert = sidebarQuery.matches && !open;
  main.inert = sidebarQuery.matches && open;
  sidebarOpenButton.setAttribute('aria-expanded', open ? 'true' : 'false');
}

function setMobileSidebar(open: boolean): void {
  const wasOpen = sidebarPanel.classList.contains('is-open');
  sidebarPanel.classList.toggle('is-open', open);
  syncMobileSidebar();
  if (sidebarQuery.matches) {
    if (open && !wasOpen) sidebarCloseButton.focus();
    else if (!open && wasOpen) sidebarOpenButton.focus();
  }
}

sidebarOpenButton.addEventListener('click', () => {
  setMobileSidebar(!sidebarPanel.classList.contains('is-open'));
});
sidebarCloseButton.addEventListener('click', () => {
  setMobileSidebar(false);
});
sidebarQuery.addEventListener('change', () => {
  if (!sidebarQuery.matches) sidebarPanel.classList.remove('is-open');
  syncMobileSidebar();
});
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || !sidebarPanel.classList.contains('is-open')) return;
  if (sidebarPanel.querySelector('.combo-menu.is-open')) return;
  setMobileSidebar(false);
});
document.addEventListener('close-mobile-sidebar', () => {
  setMobileSidebar(false);
});
syncMobileSidebar();

function syncGlobalError(): void {
  const queries = queryClient.getQueryCache().getAll();
  const hasError = queries.some((q) => q.state.status === 'error');
  const hasAnyData = queries.some((q) => q.state.data !== undefined);

  if (hasError && !hasAnyData) {
    loadError.hidden = false;
    loadError.setAttribute('aria-hidden', 'false');
    main.dataset.error = 'true';
  } else {
    loadError.hidden = true;
    loadError.setAttribute('aria-hidden', 'true');
    delete main.dataset.error;
  }
}

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
  retryButton.addEventListener('click', () => {
    loadError.hidden = true;
    loadError.setAttribute('aria-hidden', 'true');
    delete main.dataset.error;
    void queryClient.refetchQueries();
  });

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
      if (sidebarQuery.matches && !sidebarPanel.classList.contains('is-open')) {
        setMobileSidebar(true);
      }
      const appInput = document.getElementById('filter-app');
      if (appInput instanceof HTMLInputElement) {
        appInput.focus();
      }
    }
  });
}

function init(): void {
  setupTheme(themeButton, repaintCharts);
  bindControls();

  queryClient.getQueryCache().subscribe(() => {
    syncGlobalError();
  });

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
