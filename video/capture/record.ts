import * as path from 'path';
import { fileURLToPath } from 'url';
import { CaptureEngine } from './engine';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CAPTURES_DIR = path.resolve(__dirname, '..', 'captures');

const APP_URL = 'http://localhost:4321';

async function recordDesktop() {
  console.log('\n======================================================');
  console.log('🎬 INICIANDO TOMADA DESKTOP CALMA & DELIBERADA (2560x1440 @ 60 FPS)');
  console.log('======================================================');

  const outputPath = path.resolve(CAPTURES_DIR, 'desktop.mp4');
  const engine = new CaptureEngine({
    fps: 60,
    width: 2560,
    height: 1440,
    scale: 4 / 3,
    viewport: { width: 1920, height: 1080 },
    initialTheme: 'dark',
    defaultPointer: 'mouse',
    useNvenc: true,
  });

  await engine.start(outputPath);

  // -----------------------------------------------------------------
  // 1. load: goto, settle, cursor oculto, 2.2s grava
  // -----------------------------------------------------------------
  engine.mark('load');
  console.log('1. [load] Navegando e aguardando settle dos dados...');
  engine.setCursorHidden(true);
  await engine.goto(APP_URL);
  await engine.settle();
  console.log('   Dados prontos. Gravando 2.2s de comportamento real inicial...');
  await engine.record(2.2);

  // Cursor entra suavemente pela borda direita
  engine.setCursorPosition(1915, 80);
  engine.setCursorHidden(false);

  // -----------------------------------------------------------------
  // 2. theme: cursor até #theme-toggle em 1.4s, pausa 0.4s, click, grava 2.0s (escuro->claro)
  // -----------------------------------------------------------------
  engine.mark('theme');
  console.log('2. [theme] Movendo cursor até #theme-toggle em 1.4s...');
  await engine.moveCursor('#theme-toggle', 1.4);
  await engine.record(0.4); // pausa para visualizar hover no botão
  console.log('   Clicando em #theme-toggle...');
  await engine.click('theme-toggle-light');
  console.log('   Gravando 2.0s da revelação circular escuro->claro...');
  await engine.record(2.0);

  // -----------------------------------------------------------------
  // 3. month: zoom da série mensal e clique que filtra o mês
  // -----------------------------------------------------------------
  engine.mark('month');
  console.log('3. [month] Rolando até #chart-month...');
  await engine.scrollTo('#chart-month', 1.15);
  await engine.scrollTo(Math.max(0, engine.scrollY - 96), 0.4);
  await engine.waitForMonthChart();

  const monthTargets = await engine.getMonthChartTargets();
  console.log(
    `   Arrastando o zoom de (${monthTargets.handle.x.toFixed(0)}, ${monthTargets.handle.y.toFixed(0)}) até x=${monthTargets.dragTo.x.toFixed(0)}...`
  );
  await engine.moveCursor(monthTargets.handle, 0.9);
  await engine.record(0.3);
  await engine.dragCursor(monthTargets.dragTo, 1.15, 'zoom-drag');
  const zoomAfterDrag = await engine.readMonthZoom();
  console.log(`   Zoom após arraste: ${JSON.stringify(zoomAfterDrag)}`);
  if (zoomAfterDrag && zoomAfterDrag.end > 90) {
    console.warn('   Zoom não estreitou; tentando de novo a partir da alça.');
    const retry = await engine.getMonthChartTargets();
    await engine.moveCursor(retry.handle, 0.35);
    await engine.dragCursor(retry.dragTo, 0.9, 'zoom-drag-retry');
  }
  console.log('   Hold de 0.85s no gráfico aproximado...');
  await engine.record(0.85);

  const monthPoint = await engine.getVisibleMonthPoint();
  console.log(`   Hover no mês ${monthPoint.monthLabel} e clique para filtrar...`);
  await engine.moveCursor(monthPoint, 0.85);
  await engine.record(0.75);
  await engine.click('month-line');
  await engine.settle();
  console.log('   Gravando 1.6s do recorte mensal...');
  await engine.record(1.6);

  // -----------------------------------------------------------------
  // 4. dates: presets de período na sidebar, depois volta ao topo
  // -----------------------------------------------------------------
  engine.mark('dates');
  console.log('4. [dates] Movendo até o preset 2019...');
  await engine.moveCursor('[data-date-preset="2019"]', 1.05);
  await engine.record(0.35);
  await engine.click('date-preset-2019');
  await engine.settle();
  console.log('   Gravando 1.35s do preset anual...');
  await engine.record(1.35);

  console.log('   Voltando ao preset Tudo...');
  await engine.moveCursor('[data-date-preset="all"]', 0.55);
  await engine.record(0.25);
  await engine.click('date-preset-all');
  await engine.settle();
  await engine.record(0.55);

  console.log('   Rolando de volta ao topo antes da busca...');
  await engine.scrollTo(0, 1.15);

  // -----------------------------------------------------------------
  // 5. combo: press('/'), hold 0.4s, type('Dark', 6 cps), hold 0.5s,
  //    cursor até opção Darkest Dungeon (1.2s), pausa 0.4s, click, settle, grava 1.8s
  // -----------------------------------------------------------------
  engine.mark('combo');
  console.log('3. [combo] Pressionando atalho "/"...');
  await engine.press('/');
  await engine.hold(0.4);

  console.log('   Digitando "Dark" a 6 cps...');
  await engine.type('Dark', 6);
  await engine.hold(0.5);

  console.log('   Movendo cursor até a opção Darkest Dungeon em 1.2s...');
  const ddSelector = '#filter-app-list [data-value="262060"]';
  await engine.moveCursor(ddSelector, 1.2);
  await engine.record(0.4); // pausa sobre a opção destacada

  console.log('   Clicando na opção Darkest Dungeon...');
  await engine.click('combo-select-darkest-dungeon');
  console.log('   Aguardando settle da rede após filtro de jogo...');
  await engine.settle();
  console.log('   Gravando 1.8s (KPIs e gráficos atualizando)...');
  await engine.record(1.8);

  // -----------------------------------------------------------------
  // 4. crossfilter: cursor desliza até barra '1–2h' (1.4s), hover 0.8s (tooltip),
  //    desliza até barra '2–5h' (0.8s), hover 1.0s (tooltip visível), click,
  //    settle, grava 2.0s. Cursor até #active-chips (1.2s), hold 1.0s.
  // -----------------------------------------------------------------
  engine.mark('crossfilter');
  console.log('4. [crossfilter] Localizando coordenadas das barras via ECharts...');
  const barPos1 = await engine.getEChartsBarPosition('#chart-playtime', '1–2');
  const barPos2 = await engine.getEChartsBarPosition('#chart-playtime', '2–5');

  console.log(`   Movendo cursor até barra "1–2 h" em 1.4s...`);
  await engine.moveCursor(barPos1, 1.4);
  console.log('   Hover na barra "1–2 h" por 0.8s para exibir tooltip...');
  await engine.record(0.8);

  console.log(`   Movendo suavemente para barra "2–5 h" em 0.8s...`);
  await engine.moveCursor(barPos2, 0.8);
  console.log('   Hover na barra "2–5 h" por 1.0s para leitura do tooltip...');
  await engine.record(1.0);

  console.log('   Clicando na barra "2–5 h"...');
  await engine.click('chart-bar-playtime-2-5h');
  console.log('   Aguardando settle da rede após crossfilter...');
  await engine.settle();
  console.log('   Gravando 2.0s (KPIs e gráficos reagindo)...');
  await engine.record(2.0);

  console.log('   Movendo cursor até #active-chips em 1.2s...');
  await engine.moveCursor('#active-chips', 1.2);
  console.log('   Hold de 1.0s para visualização dos chips...');
  await engine.hold(1.0);

  // -----------------------------------------------------------------
  // 5. preset: cursor até [data-preset="early"] em 1.2s, pausa 0.4s, click, settle, grava 1.8s
  // -----------------------------------------------------------------
  engine.mark('preset');
  console.log('5. [preset] Movendo cursor até [data-preset="early"] em 1.2s...');
  await engine.moveCursor('[data-preset="early"]', 1.2);
  await engine.record(0.4);

  console.log('   Clicando no preset Early Access...');
  await engine.click('preset-early');
  console.log('   Aguardando settle da rede após preset...');
  await engine.settle();
  console.log('   Gravando 1.8s...');
  await engine.record(1.8);

  // -----------------------------------------------------------------
  // 6. table: scrollTo até #reviews-heading em 1.4s;
  //    cursor até [data-sort-by="votes_helpful"] em 1.2s, pausa 0.4s, click, settle, grava 1.2s;
  //    cursor até primeira linha (1.2s), pausa 0.4s, click para expandir, grava 1.8s
  // -----------------------------------------------------------------
  engine.mark('table');
  console.log('6. [table] Rolando suavemente até #reviews-heading em 1.4s...');
  await engine.scrollTo('#reviews-heading', 1.4);

  console.log('   Movendo cursor até ordenação por "Mais úteis" em 1.2s...');
  await engine.moveCursor('[data-sort-by="votes_helpful"]', 1.2);
  await engine.record(0.4);

  console.log('   Clicando para ordenar por votos úteis...');
  await engine.click('sort-votes-helpful');
  console.log('   Aguardando settle da rede...');
  await engine.settle();
  console.log('   Gravando 1.2s...');
  await engine.record(1.2);

  console.log('   Movendo até ordenação por horas...');
  await engine.moveCursor('[data-sort-by="playtime_hours"]', 0.7);
  await engine.record(0.3);
  await engine.click('sort-playtime-hours');
  await engine.settle();
  console.log('   Gravando 0.7s da ordenação por horas...');
  await engine.record(0.7);

  console.log('   Rolando a tabela virtualizada...');
  await engine.scrollElement('[data-reviews-virtual="true"]', 280, 0.85);
  await engine.record(0.45);
  await engine.scrollElement('[data-reviews-virtual="true"]', -280, 0.6);

  console.log('   Movendo cursor até a primeira linha da tabela em 1.2s...');
  await engine.moveCursor('#reviews-body tr.review-row:first-child', 1.2);
  await engine.record(0.4);

  console.log('   Clicando na primeira linha para expandir...');
  await engine.click('expand-first-review');
  console.log('   Gravando 1.8s (linha expandida)...');
  await engine.record(1.8);

  // -----------------------------------------------------------------
  // 7. reset: scrollTo(0) em 1.2s; cursor até #clear-filters em 1.2s, pausa 0.4s,
  //    click, settle, grava 1.0s; cursor até #theme-toggle em 1.2s, pausa 0.4s,
  //    click, grava 2.0s (claro->escuro); hold 1.0s
  // -----------------------------------------------------------------
  engine.mark('reset');
  console.log('7. [reset] Rolando de volta para o topo (scrollY = 0) em 1.2s...');
  await engine.scrollTo(0, 1.2);

  console.log('   Movendo cursor até #clear-filters em 1.2s...');
  await engine.moveCursor('#clear-filters', 1.2);
  await engine.record(0.4);

  console.log('   Clicando em Limpar Filtros...');
  await engine.click('clear-filters');
  console.log('   Aguardando settle da rede...');
  await engine.settle();
  console.log('   Gravando 1.0s...');
  await engine.record(1.0);

  console.log('   Movendo cursor até #theme-toggle em 1.2s...');
  await engine.moveCursor('#theme-toggle', 1.2);
  await engine.record(0.4);

  console.log('   Clicando em #theme-toggle para voltar ao tema escuro...');
  await engine.click('theme-toggle-dark');
  console.log('   Gravando 2.0s (revelação claro->escuro)...');
  await engine.record(2.0);

  console.log('   Hold final de 1.0s...');
  await engine.hold(1.0);

  console.log('Finalizando gravação desktop...');
  const res = await engine.close();
  console.log(`✅ Tomada Desktop finalizada: ${res.totalFrames} quadros (${res.durationSeconds.toFixed(2)}s)`);
  return res;
}

async function recordMobile() {
  console.log('\n======================================================');
  console.log('📱 INICIANDO TOMADA MOBILE (1170x2532 @ 60 FPS)');
  console.log('======================================================');

  const outputPath = path.resolve(CAPTURES_DIR, 'mobile.mp4');
  const engine = new CaptureEngine({
    fps: 60,
    width: 1170,
    height: 2532,
    scale: 3,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    initialTheme: 'light',
    defaultPointer: 'touch',
    useNvenc: true,
  });

  await engine.start(outputPath);

  // -----------------------------------------------------------------
  // 1. m_load: settle dados, grava 1.0s
  // -----------------------------------------------------------------
  engine.mark('m_load');
  console.log('1. [m_load] Navegando em mobile (tema claro inicial)...');
  await engine.goto(APP_URL);
  await engine.settle();
  console.log('   Dados carregados. Gravando 1.0s...');
  await engine.record(1.0);

  // -----------------------------------------------------------------
  // 2. m_open: tap #sidebar-open, grava 1.2s (gaveta deslizando)
  // -----------------------------------------------------------------
  engine.mark('m_open');
  console.log('2. [m_open] Toque em #sidebar-open...');
  await engine.tap('#sidebar-open', 'tap-sidebar-open');
  console.log('   Gravando 1.2s da animação de gaveta deslizando...');
  await engine.record(1.2);

  // -----------------------------------------------------------------
  // 3. m_filter: tap [data-tri-filter="recommended"][data-tri-value="yes"], settle, grava 0.8s
  // -----------------------------------------------------------------
  engine.mark('m_filter');
  const filterSel = '[data-tri-filter="recommended"][data-tri-value="yes"]';
  console.log(`3. [m_filter] Toque no filtro recomendado (${filterSel})...`);
  await engine.tap(filterSel, 'tap-tri-filter-recommended-yes');
  console.log('   Aguardando settle dos dados...');
  await engine.settle();
  console.log('   Gravando 0.8s...');
  await engine.record(0.8);

  // -----------------------------------------------------------------
  // 4. m_close: tap #sidebar-close, grava 1.6s (KPIs atualizando).
  //    Depois scrollTo 600px em 1.4s, hold 0.8s
  // -----------------------------------------------------------------
  engine.mark('m_close');
  console.log('4. [m_close] Toque em #sidebar-close...');
  await engine.tap('#sidebar-close', 'tap-sidebar-close');
  console.log('   Gravando 1.6s (gaveta fechando e KPIs atualizando)...');
  await engine.record(1.6);

  console.log('   Rolando 600px em 1.4s...');
  await engine.scrollTo(600, 1.4);

  console.log('   Hold final de 0.8s...');
  await engine.hold(0.8);

  console.log('Finalizando gravação mobile...');
  const res = await engine.close();
  console.log(`✅ Tomada Mobile finalizada: ${res.totalFrames} quadros (${res.durationSeconds.toFixed(2)}s)`);
  return res;
}

async function main() {
  console.log('======================================================');
  console.log('🚀 RE-GRAVAÇÃO DETERMINÍSTICA: RITMO CALMO E TOOLTIP HOVER');
  console.log('======================================================');

  const only = process.argv[2] ?? 'all';
  const startTotal = performance.now();
  const desktopResult = only === 'mobile' ? null : await recordDesktop();
  const mobileResult = only === 'desktop' ? null : await recordMobile();
  const totalElapsed = (performance.now() - startTotal) / 1000;

  console.log('\n======================================================');
  console.log('🎉 RE-GRAVAÇÕES CONCLUÍDAS COM SUCESSO!');
  console.log(`Tempo total de execução: ${totalElapsed.toFixed(2)}s`);
  if (desktopResult) {
    console.log(`Desktop: ${desktopResult.mp4Path} (${desktopResult.totalFrames} frames, ${desktopResult.durationSeconds.toFixed(2)}s)`);
  }
  if (mobileResult) {
    console.log(`Mobile:  ${mobileResult.mp4Path} (${mobileResult.totalFrames} frames, ${mobileResult.durationSeconds.toFixed(2)}s)`);
  }
  console.log('======================================================\n');
}

main().catch((err) => {
  console.error('\n❌ ERRO FATAL NA EXECUÇÃO:', err);
  process.exit(1);
});
