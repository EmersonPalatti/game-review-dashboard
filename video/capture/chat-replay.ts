/**
 * Peças compartilhadas das tomadas do chat: rolagem suave determinística e
 * reprodução de respostas reais gravadas (capture/fixtures).
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import type { Page } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const FIXTURES_DIR = path.resolve(__dirname, 'fixtures');

/**
 * O chat rola com scrollIntoView({ behavior: 'smooth' }) a cada token. No Chrome
 * headless essa rolagem acontece de uma vez, um salto por linha nova, e o texto
 * treme no vídeo. Aqui a rolagem pedida pela página vira o alvo de uma mola
 * criticamente amortecida, movida por requestAnimationFrame e performance.now
 * (os dois sob page.clock): o destino é o mesmo, mas o movimento é contínuo e
 * determinístico.
 *
 * O script vai como texto puro: o tsx (esbuild) injeta __name() em funções
 * nomeadas, e esse helper não existe dentro da página.
 */
const DETERMINISTIC_SCROLL_SCRIPT = String.raw`
(() => {
  if (window.__captureScrollInstalled) return;
  window.__captureScrollInstalled = true;
  var OMEGA = 11; // rad/s: assenta em ~0,4 s, sem ultrapassar o alvo
  var springs = new Map();

  function injectStyle() {
    if (document.getElementById('capture-no-smooth-scroll')) return;
    var style = document.createElement('style');
    style.id = 'capture-no-smooth-scroll';
    style.textContent = '*, html { scroll-behavior: auto !important; }';
    (document.head || document.documentElement).appendChild(style);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectStyle);
  else injectStyle();

  function scrollParents(el) {
    var list = [];
    for (var node = el.parentElement; node; node = node.parentElement) {
      var overflowY = getComputedStyle(node).overflowY;
      if (/(auto|scroll)/.test(overflowY) && node.scrollHeight > node.clientHeight) list.push(node);
    }
    if (document.scrollingElement) list.push(document.scrollingElement);
    return list;
  }

  function follow(el, target) {
    var s = springs.get(el);
    if (s) { s.target = target; return; }
    s = { x: el.scrollTop, v: 0, target: target, last: performance.now() };
    springs.set(el, s);
    function step() {
      var now = performance.now();
      var dt = Math.min(0.05, Math.max(0.001, (now - s.last) / 1000));
      s.last = now;
      var a = OMEGA * OMEGA * (s.target - s.x) - 2 * OMEGA * s.v;
      s.v += a * dt;
      s.x += s.v * dt;
      var max = el.scrollHeight - el.clientHeight;
      if (s.x > max) { s.x = max; s.v = 0; }
      if (s.x < 0) { s.x = 0; s.v = 0; }
      el.scrollTop = s.x;
      if (Math.abs(s.target - s.x) < 0.3 && Math.abs(s.v) < 0.3) {
        el.scrollTop = s.target;
        springs.delete(el);
        return;
      }
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  var original = Element.prototype.scrollIntoView;
  Element.prototype.scrollIntoView = function (arg) {
    if (typeof arg !== 'object' || arg === null || arg.behavior !== 'smooth') {
      return original.call(this, arg);
    }
    // Destino igual ao do Chrome: rola na hora, mede, volta e deixa a mola levar.
    var parents = scrollParents(this);
    var before = parents.map(function (p) {
      var s = springs.get(p);
      return s ? s.x : p.scrollTop;
    });
    original.call(this, Object.assign({}, arg, { behavior: 'instant' }));
    parents.forEach(function (p, i) {
      var target = p.scrollTop;
      p.scrollTop = before[i];
      if (Math.abs(target - before[i]) >= 0.5 || springs.has(p)) follow(p, target);
    });
  };
})();
`;

export async function installDeterministicScroll(page: Page): Promise<void> {
  await page.addInitScript({ content: DETERMINISTIC_SCROLL_SCRIPT });
}

export interface StreamFixture {
  question: string;
  contentType: string | null;
  chunks: { t: number; data: string }[];
}

export function loadStream(name: string): StreamFixture {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, `${name}.stream.json`), 'utf-8')) as StreamFixture;
}

/**
 * Troca o POST /api/chat/stream da página pela resposta real gravada. Cada pedaço
 * do SSE entra no mesmo instante em que chegou na gravação, medido pelo relógio
 * virtual (setTimeout fica sob page.clock), então o ritmo é o original.
 */
export async function installStreamReplay(page: Page, fixture: StreamFixture): Promise<void> {
  await page.addInitScript(
    ({ chunks, contentType }) => {
      const realFetch = window.fetch.bind(window);
      window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (!url.includes('/api/chat/stream')) return realFetch(input, init);
        const encoder = new TextEncoder();
        const body = new ReadableStream<Uint8Array>({
          start(controller) {
            for (const chunk of chunks) {
              setTimeout(() => controller.enqueue(encoder.encode(chunk.data)), chunk.t);
            }
            const last = chunks.length ? chunks[chunks.length - 1].t : 0;
            setTimeout(() => controller.close(), last + 5);
          },
        });
        return Promise.resolve(
          new Response(body, {
            status: 200,
            headers: { 'content-type': contentType ?? 'text/event-stream' },
          }),
        );
      };
    },
    { chunks: fixture.chunks, contentType: fixture.contentType },
  );
}
