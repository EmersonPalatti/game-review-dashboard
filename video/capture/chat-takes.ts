/**
 * Tomadas reais do chat para o vídeo ChatUpgrade (roteiro em video/roteiro-chat-v2.md).
 *
 *   npx tsx capture/chat-takes.ts v1        → captures/chat-v1.mp4
 *   npx tsx capture/chat-takes.ts search    → captures/chat-v2-search.mp4
 *   npx tsx capture/chat-takes.ts compare   → captures/chat-v2-compare.mp4
 *
 * As respostas não são geradas na hora: cada tomada reproduz uma resposta real
 * gravada antes (capture/fixtures). Assim a captura fica determinística com o
 * relógio virtual, e o conteúdo continua sendo o da execução real.
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import type { Page, Route } from 'playwright';
import { CaptureEngine } from './engine';
import { FIXTURES_DIR, installDeterministicScroll, installStreamReplay, loadStream } from './chat-replay';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CAPTURES_DIR = path.resolve(__dirname, '..', 'captures');

const APP_URL = 'http://localhost:4321';
/** Frontend do v1 (worktree em 8276d49) servido à parte; os dados vêm do mesmo backend. */
const APP_URL_V1 = process.env.APP_URL_V1 ?? 'http://localhost:4322';

/** Pergunta da tomada v1 (fixture v1-response.json). */
export const QUESTION_V1 = 'Do que reclamam os jogadores com 500 h+ que reprovaram Arma 3?';

/**
 * Grava a resposta acompanhando o tempo da página desde o envio da pergunta.
 * `realtime(até)` grava em 1×; `fast(até, speed)` comprime a espera e deixa
 * marks fast-start/fast-end para o vídeo sinalizar o trecho acelerado.
 */
function makeSchedule(engine: CaptureEngine) {
  let pageT = 0;
  return {
    async realtime(untilS: number) {
      if (untilS > pageT) await engine.record(untilS - pageT);
      pageT = Math.max(pageT, untilS);
    },
    async fast(untilS: number, speed: number) {
      if (untilS <= pageT) return;
      engine.mark(`fast-start:${speed}`);
      await engine.recordFast(untilS - pageT, speed);
      engine.mark('fast-end');
      pageT = untilS;
    },
    mark(name: string) {
      engine.mark(name);
    },
  };
}

function makeEngine(): CaptureEngine {
  return new CaptureEngine({
    fps: 60,
    width: 3840,
    height: 2160,
    scale: 2,
    viewport: { width: 1920, height: 1080 },
    initialTheme: 'dark',
    defaultPointer: 'mouse',
    useNvenc: true,
    pauseClock: true,
  });
}

async function openChat(engine: CaptureEngine, page: Page): Promise<void> {
  engine.mark('open');
  await page.locator('button[aria-label^="Abrir assistente"]').click();
  await engine.record(1.2);
}

async function ask(engine: CaptureEngine, page: Page, question: string): Promise<void> {
  await page.locator('.chat-drawer textarea').fill(question);
  await engine.record(0.5);
  engine.mark('ask');
  await engine.press('Enter');
}

/**
 * T0 · chat v1: loader por cronômetro e resposta inteira de uma vez.
 * A espera real (24,4 s) vira um corte: 3,2 s gravados, 18 s que passam no
 * relógio da página sem gravar (mark skip:18) e os 3,2 s finais gravados.
 * O contador do loader mostra o tempo real dos dois lados do corte.
 */
async function takeV1(): Promise<void> {
  const fixture = fs.readFileSync(path.join(FIXTURES_DIR, 'v1-response.json'), 'utf-8');
  // Latência real medida ao gravar a fixture (curl em /api/chat do v1).
  const REAL_LATENCY_S = 24.4;
  const REALTIME_S = 3.2;
  const SKIPPED_S = REAL_LATENCY_S - 2 * REALTIME_S;

  let release: () => void = () => {};
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });

  const engine = makeEngine();
  await engine.start(path.join(CAPTURES_DIR, 'chat-v1.mp4'));
  const page = engine.getPage();
  await installDeterministicScroll(page);
  await page.route('**/api/chat', async (route: Route) => {
    await released;
    await route.fulfill({ status: 200, contentType: 'application/json', body: fixture });
  });

  engine.setCursorHidden(true);
  await engine.goto(APP_URL_V1);
  await engine.settle();
  await engine.record(0.6);

  await openChat(engine, page);
  await ask(engine, page, QUESTION_V1);

  await engine.record(REALTIME_S);
  engine.mark(`skip:${SKIPPED_S}`);
  await page.clock.runFor(SKIPPED_S * 1000);
  await page.evaluate(`window.__step(${SKIPPED_S * 1000})`);
  await engine.record(REALTIME_S);

  release();
  await engine.settle(async () =>
    page.evaluate(() => document.querySelectorAll('.chat-msg-row-bot').length > 1 && !document.querySelector('.chat-loading')),
  );
  engine.mark('answer');
  await engine.record(3.5);

  const result = await engine.close();
  console.log(`v1: ${result.totalFrames} frames (${result.durationSeconds.toFixed(1)} s) → ${result.mp4Path}`);
}

/**
 * T1 · busca híbrida. Tempos da fixture (s desde o envio): resolve_game 2,46;
 * search_reviews_hybrid 3,81 → 3,96 com o widget de evidências; texto 6,6 → 13,7.
 */
async function takeSearch(): Promise<void> {
  const fixture = loadStream('search');
  const engine = makeEngine();
  await engine.start(path.join(CAPTURES_DIR, 'chat-v2-search.mp4'));
  const page = engine.getPage();
  await installDeterministicScroll(page);
  await installStreamReplay(page, fixture);

  engine.setCursorHidden(true);
  await engine.goto(APP_URL);
  await engine.settle();
  await engine.record(0.5);
  await openChat(engine, page);
  await ask(engine, page, fixture.question);

  const s = makeSchedule(engine);
  await s.realtime(2.46);
  s.mark('first-tool');
  await s.realtime(3.96);
  s.mark('widget');
  await s.realtime(6.6);
  s.mark('first-token');
  await s.realtime(13.75);
  s.mark('done');
  await engine.record(1.5);

  const result = await engine.close();
  console.log(`search: ${result.totalFrames} frames (${result.durationSeconds.toFixed(1)} s) → ${result.mp4Path}`);
}

/**
 * T2 · comparativo com chip de filtro. Tempos da fixture (s desde o envio):
 * resolve_game ×2 em 8,70; compare_slices 12,39 → 12,64 com o widget;
 * propose_dashboard_actions 12,40; texto 14,24 → 19,19; fim 19,20.
 */
async function takeCompare(): Promise<void> {
  const fixture = loadStream('compare');
  const engine = makeEngine();
  await engine.start(path.join(CAPTURES_DIR, 'chat-v2-compare.mp4'));
  const page = engine.getPage();
  await installDeterministicScroll(page);
  await installStreamReplay(page, fixture);

  engine.setCursorHidden(true);
  await engine.goto(APP_URL);
  await engine.settle();
  await engine.record(0.5);
  await openChat(engine, page);
  await ask(engine, page, fixture.question);

  const s = makeSchedule(engine);
  await s.realtime(1.0);
  await s.fast(8.3, 4);
  await s.realtime(8.7);
  s.mark('first-tool');
  await s.realtime(12.64);
  s.mark('widget');
  await s.realtime(14.24);
  s.mark('first-token');
  await s.realtime(19.3);
  s.mark('done');
  await engine.record(1.0);

  // Cursor entra pela direita e clica no chip de filtro sugerido.
  const chip = page.locator('.chat-copilot-actions button').first();
  await chip.scrollIntoViewIfNeeded();
  await engine.record(0.4);
  const box = await chip.boundingBox();
  if (!box) throw new Error('Chip de filtro não encontrado');
  engine.setCursorPosition(box.x + box.width / 2 + 140, box.y + 160);
  engine.setCursorHidden(false);
  await engine.moveCursor({ x: box.x + box.width / 2, y: box.y + box.height / 2 }, 0.8);
  await engine.record(0.25);
  await engine.click('chip');
  await engine.settle();
  engine.mark('kpi-update');
  await engine.record(2.0);
  engine.mark('undo-visible');
  await engine.record(1.5);

  const result = await engine.close();
  console.log(`compare: ${result.totalFrames} frames (${result.durationSeconds.toFixed(1)} s) → ${result.mp4Path}`);
}

const TAKES: Record<string, () => Promise<void>> = {
  v1: takeV1,
  search: takeSearch,
  compare: takeCompare,
};

const takeName = process.argv[2];
const run = TAKES[takeName];
if (!run) {
  console.error(`Tomada desconhecida: ${takeName}. Opções: ${Object.keys(TAKES).join(', ')}`);
  process.exit(1);
}
run().catch((err) => {
  console.error(err);
  process.exit(1);
});
