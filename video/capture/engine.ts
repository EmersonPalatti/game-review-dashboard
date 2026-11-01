import {
  chromium,
  type Browser,
  type BrowserContext,
  type CDPSession,
  type Page,
} from 'playwright';
import { spawn, type ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export interface CursorPosition {
  x: number;
  y: number;
  down: boolean;
  pointer: 'mouse' | 'touch';
  hidden: boolean;
}

export interface TimelineFrame {
  frame: number;
  cursor: CursorPosition;
  scrollY: number;
}

export interface TimelineEvent {
  frame: number;
  type: 'click' | 'key' | 'mark' | 'theme' | 'tap';
  name: string;
}

export interface TimelineData {
  fps: number;
  width: number;
  height: number;
  totalFrames: number;
  durationSeconds: number;
  frames: TimelineFrame[];
  events: TimelineEvent[];
}

export interface CaptureOptions {
  fps?: number;
  width?: number;
  height?: number;
  scale?: number;
  viewport?: { width: number; height: number };
  isMobile?: boolean;
  hasTouch?: boolean;
  initialTheme?: 'dark' | 'light';
  defaultPointer?: 'mouse' | 'touch';
  ffmpegPath?: string;
  useNvenc?: boolean;
}

export interface CloseResult {
  totalFrames: number;
  durationSeconds: number;
  mp4Path: string;
  timelinePath: string;
  elapsedMs: number;
  avgMsPerFrame: number;
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

const WINGET_FFMPEG =
  'C:\\Users\\enama\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-9.0.2-full_build\\bin\\ffmpeg.exe';
const DEFAULT_FFMPEG =
  process.env.FFMPEG_PATH || (fs.existsSync(WINGET_FFMPEG) ? WINGET_FFMPEG : 'ffmpeg');

export class CaptureEngine {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private cdpSession: CDPSession | null = null;
  private ffmpegProc: ChildProcess | null = null;

  public readonly fps: number;
  public readonly videoWidth: number;
  public readonly videoHeight: number;
  public readonly cssWidth: number;
  public readonly cssHeight: number;
  public readonly scale: number;
  public readonly frameMs: number;
  public readonly isMobile: boolean;
  public readonly hasTouch: boolean;
  public readonly initialTheme: 'dark' | 'light';
  public readonly defaultPointer: 'mouse' | 'touch';
  public readonly ffmpegPath: string;
  public readonly useNvenc: boolean;

  private currentFrame = 0;
  private currentCursor: {
    x: number;
    y: number;
    down: boolean;
    pointer: 'mouse' | 'touch';
    hidden: boolean;
  };
  private currentScrollY = 0;
  private timeline: TimelineData;
  private outputPath = '';
  private timelinePath = '';
  private captureStartTime = 0;
  private lastCapturedBuffer: Buffer | null = null;
  private hasResetRise = false;

  constructor(options: CaptureOptions = {}) {
    this.fps = options.fps ?? 60;
    this.videoWidth = options.width ?? 2560;
    this.videoHeight = options.height ?? 1440;
    this.scale = options.scale ?? 4 / 3;
    this.isMobile = options.isMobile ?? false;
    this.hasTouch = options.hasTouch ?? false;
    this.initialTheme = options.initialTheme ?? 'dark';
    this.defaultPointer = options.defaultPointer ?? (this.isMobile ? 'touch' : 'mouse');
    this.ffmpegPath = options.ffmpegPath ?? DEFAULT_FFMPEG;
    this.useNvenc = options.useNvenc ?? true;

    if (options.viewport) {
      this.cssWidth = options.viewport.width;
      this.cssHeight = options.viewport.height;
    } else {
      this.cssWidth = Math.round(this.videoWidth / this.scale);
      this.cssHeight = Math.round(this.videoHeight / this.scale);
    }

    this.frameMs = 1000 / this.fps;

    this.currentCursor = {
      x: this.cssWidth / 2,
      y: this.cssHeight / 2,
      down: false,
      pointer: this.defaultPointer,
      hidden: false,
    };

    this.timeline = {
      fps: this.fps,
      width: this.videoWidth,
      height: this.videoHeight,
      totalFrames: 0,
      durationSeconds: 0,
      frames: [],
      events: [],
    };
  }

  public getPage(): Page {
    if (!this.page) throw new Error('Engine not started');
    return this.page;
  }

  public getCurrentFrame(): number {
    return this.currentFrame;
  }

  public setCursorPosition(x: number, y: number): void {
    this.currentCursor.x = x;
    this.currentCursor.y = y;
  }

  public setCursorHidden(hidden: boolean): void {
    this.currentCursor.hidden = hidden;
  }

  public setCursorPointer(pointer: 'mouse' | 'touch'): void {
    this.currentCursor.pointer = pointer;
  }

  public async start(outputPath: string): Promise<void> {
    this.outputPath = path.resolve(outputPath);
    const dir = path.dirname(this.outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const baseNoExt = this.outputPath.replace(/\.mp4$/i, '');
    this.timelinePath = `${baseNoExt}.timeline.json`;

    this.browser = await chromium.launch({
      headless: true,
      args: ['--hide-scrollbars', '--disable-infobars'],
    });

    this.context = await this.browser.newContext({
      viewport: { width: this.cssWidth, height: this.cssHeight },
      deviceScaleFactor: this.scale,
      isMobile: this.isMobile,
      hasTouch: this.hasTouch,
      reducedMotion: 'no-preference',
      colorScheme: this.initialTheme,
    });

    // Injeção de scripts essenciais antes do carregamento da página:
    // 1. LocalStorage com o tema inicial solicitado (dark ou light)
    // 2. CSS para esconder a barra do Astro dev toolbar (apenas cosmético de captura)
    // 3. Helper window.__step(ms) para avançar deterministicamente Web Animations e CSS Animations
    await this.context.addInitScript({
      content: `
        try {
          localStorage.setItem('steam-reviews-theme', '${this.initialTheme}');
        } catch (e) {}

        // Ocultar barra do Astro dev toolbar e caret de inputs
        const injectHideToolbar = () => {
          try {
            if (document.getElementById('hide-astro-toolbar')) return;
            const target = document.head || document.documentElement;
            if (target) {
              const style = document.createElement('style');
              style.id = 'hide-astro-toolbar';
              style.textContent = 'astro-dev-toolbar { display: none !important; } input, textarea { caret-color: transparent !important; }';
              target.appendChild(style);
            }
          } catch (e) {}
        };
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', injectHideToolbar);
        } else {
          injectHideToolbar();
        }

        const seen = new WeakSet();
        window.__seenAnims = seen;

        // Intercepta Element.prototype.animate para nascer pausada em t=0 (essencial para View Transition)
        const origAnimate = Element.prototype.animate;
        Element.prototype.animate = function(...args) {
          const anim = origAnimate.apply(this, args);
          seen.add(anim);
          try {
            anim.pause();
            anim.currentTime = 0;
          } catch (e) {}
          return anim;
        };

        window.__step = function(ms) {
          const getList = () => {
            if (typeof document.documentElement.getAnimations === 'function') {
              return document.documentElement.getAnimations({ subtree: true });
            }
            return document.getAnimations();
          };

          const anims = getList();
          for (const anim of anims) {
            if (anim.playState === 'finished') continue;
            if (!seen.has(anim)) {
              seen.add(anim);
              try {
                anim.pause();
                anim.currentTime = 0;
              } catch (e) {}
            } else {
              const timing = anim.effect ? anim.effect.getComputedTiming() : null;
              const endTime = timing ? timing.endTime : Infinity;
              const current = (anim.currentTime != null) ? anim.currentTime : 0;
              const next = current + ms;
              if (Number.isFinite(endTime) && next >= endTime) {
                anim.currentTime = endTime;
                try {
                  anim.finish();
                } catch (e) {}
              } else {
                anim.currentTime = next;
              }
            }
          }
        };

        window.__resetRiseAnimations = function() {
          const getList = () => {
            if (typeof document.documentElement.getAnimations === 'function') {
              return document.documentElement.getAnimations({ subtree: true });
            }
            return document.getAnimations();
          };
          for (const anim of getList()) {
            seen.add(anim);
            try {
              anim.pause();
              anim.currentTime = 0;
            } catch (e) {}
          }
        };
      `,
    });

    this.page = await this.context.newPage();

    // Relógio virtual instalado antes da navegação para controle determinístico
    await this.page.clock.install();

    this.cdpSession = await this.context.newCDPSession(this.page);

    this.startFfmpegProcess();
    this.captureStartTime = performance.now();
  }

  private startFfmpegProcess(): void {
    const encoderArgs = this.useNvenc
      ? ['-c:v', 'h264_nvenc', '-cq', '14', '-preset', 'p7']
      : ['-c:v', 'libx264', '-crf', '12', '-preset', 'slow'];

    const args = [
      '-y',
      '-f',
      'image2pipe',
      '-framerate',
      this.fps.toString(),
      '-i',
      '-',
      ...encoderArgs,
      '-pix_fmt',
      'yuv420p',
      '-r',
      this.fps.toString(),
      this.outputPath,
    ];

    this.ffmpegProc = spawn(this.ffmpegPath, args, {
      stdio: ['pipe', 'inherit', 'inherit'],
    });

    this.ffmpegProc.on('error', (err) => {
      console.error('[CaptureEngine] FFmpeg process error:', err);
    });
  }

  public async goto(url: string): Promise<void> {
    if (!this.page) throw new Error('Engine not started');
    await this.page.goto(url, { waitUntil: 'commit' });
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Aguarda dados reais da API sem avançar o relógio virtual nem gravar quadros.
   */
  public async settle(
    condition?: () => Promise<boolean> | boolean,
    timeoutMs = 45000
  ): Promise<void> {
    if (!this.page) throw new Error('Engine not started');

    // Aguarda um pequeno delay para que qualquer clique assíncrono dispare load()
    await this.page.clock.runFor(60);
    await new Promise((r) => setTimeout(r, 60));

    const start = Date.now();
    const checkFn =
      condition ??
      (async () => {
        return await this.page!.evaluate<boolean>(() => {
          const fetching = document.documentElement.dataset.fetching === 'true';
          const text = document.getElementById('metric-reviews')?.textContent?.trim();
          return !fetching && Boolean(text && text !== '—');
        });
      });

    while (Date.now() - start < timeoutMs) {
      await this.page.clock.runFor(40);
      const ready = await checkFn();
      if (ready) {
        if (!this.hasResetRise) {
          this.hasResetRise = true;
          // Reinicia animações reais do CSS apenas no frame 0 da gravação inicial
          await this.page.evaluate(`
            if (typeof window.__resetRiseAnimations === "function") {
              window.__resetRiseAnimations();
            }
          `);
        }
        return;
      }
      await new Promise((r) => setTimeout(r, 40));
    }

    throw new Error(`[CaptureEngine] Settle timed out after ${timeoutMs}ms`);
  }

  private async writeBufferToFfmpeg(buf: Buffer): Promise<void> {
    if (!this.ffmpegProc || !this.ffmpegProc.stdin) {
      throw new Error('FFmpeg stdin not available');
    }

    const canWrite = this.ffmpegProc.stdin.write(buf);
    if (!canWrite) {
      await new Promise<void>((resolve) => {
        this.ffmpegProc!.stdin!.once('drain', () => resolve());
      });
    }
  }

  private recordTimelineFrame(): void {
    const videoX = Math.round(this.currentCursor.x * this.scale);
    const videoY = Math.round(this.currentCursor.y * this.scale);

    this.timeline.frames.push({
      frame: this.currentFrame,
      cursor: {
        x: videoX,
        y: videoY,
        down: this.currentCursor.down,
        pointer: this.currentCursor.pointer,
        hidden: this.currentCursor.hidden,
      },
      scrollY: Math.round(this.currentScrollY * this.scale),
    });
  }

  /**
   * Avança um único quadro físico no tempo virtual e grava no vídeo.
   */
  public async stepFrame(): Promise<void> {
    if (!this.page || !this.cdpSession) throw new Error('Engine not started');

    await this.page.clock.runFor(this.frameMs);
    await this.page.evaluate(`window.__step(${this.frameMs})`);

    const snap = await this.cdpSession.send('Page.captureScreenshot', {
      format: 'png',
      clip: {
        x: 0,
        y: this.currentScrollY,
        width: this.cssWidth,
        height: this.cssHeight,
        scale: this.scale,
      },
      captureBeyondViewport: false,
    });

    const buf = Buffer.from(snap.data, 'base64');
    this.lastCapturedBuffer = buf;

    await this.writeBufferToFfmpeg(buf);
    this.recordTimelineFrame();
    this.currentFrame++;
  }

  /**
   * Grava N segundos avançando o tempo determinístico a cada quadro.
   */
  public async record(seconds: number): Promise<void> {
    const totalFrames = Math.max(1, Math.round(seconds * this.fps));
    for (let i = 0; i < totalFrames; i++) {
      await this.stepFrame();
    }
  }

  /**
   * Grava N segundos com o tempo parado (estático), repetindo o quadro atual.
   */
  public async hold(seconds: number): Promise<void> {
    if (!this.page || !this.cdpSession) throw new Error('Engine not started');

    const totalFrames = Math.max(1, Math.round(seconds * this.fps));
    if (totalFrames <= 0) return;

    // Atualiza o buffer estático para a posição e estado atuais
    const snap = await this.cdpSession.send('Page.captureScreenshot', {
      format: 'png',
      clip: {
        x: 0,
        y: this.currentScrollY,
        width: this.cssWidth,
        height: this.cssHeight,
        scale: this.scale,
      },
      captureBeyondViewport: false,
    });
    this.lastCapturedBuffer = Buffer.from(snap.data, 'base64');

    const staticBuffer = this.lastCapturedBuffer;
    for (let i = 0; i < totalFrames; i++) {
      await this.writeBufferToFfmpeg(staticBuffer);
      this.recordTimelineFrame();
      this.currentFrame++;
    }
  }

  /**
   * Move o cursor do mouse quadro a quadro com easing e leve curva.
   */
  public async moveCursor(
    selectorOrPoint: string | { x: number; y: number },
    durationSec: number,
    easing: (t: number) => number = easeInOutCubic
  ): Promise<void> {
    if (!this.page) throw new Error('Engine not started');

    let targetX = 0;
    let targetY = 0;

    if (typeof selectorOrPoint === 'string') {
      const locator = this.page.locator(selectorOrPoint);
      const box = await locator.boundingBox();
      if (!box) {
        throw new Error(`Element not found for moveCursor: ${selectorOrPoint}`);
      }
      targetX = box.x + box.width / 2;
      targetY = box.y + box.height / 2;
    } else {
      targetX = selectorOrPoint.x;
      targetY = selectorOrPoint.y;
    }

    const startX = this.currentCursor.x;
    const startY = this.currentCursor.y;
    const dx = targetX - startX;
    const dy = targetY - startY;
    const dist = Math.hypot(dx, dy);

    let perpX = 0;
    let perpY = 0;
    if (dist > 0.001) {
      perpX = -dy / dist;
      perpY = dx / dist;
    }
    const curvature = Math.min(dist * 0.05, 18);

    const steps = Math.max(1, Math.round(durationSec * this.fps));
    this.currentCursor.pointer = 'mouse';

    for (let step = 1; step <= steps; step++) {
      const t = step / steps;
      const easedT = easing(t);
      const curveOffset = Math.sin(t * Math.PI) * curvature;

      const curX = startX + dx * easedT + perpX * curveOffset;
      const curY = startY + dy * easedT + perpY * curveOffset;

      await this.page.mouse.move(curX, curY);
      this.currentCursor.x = curX;
      this.currentCursor.y = curY;

      await this.stepFrame();
    }
  }

  /**
   * Rola a janela quadro a quadro (instantâneo por quadro com easing), gravando quadros.
   */
  public async scrollTo(
    selectorOrY: string | number,
    durationSec: number,
    easing: (t: number) => number = easeInOutCubic
  ): Promise<void> {
    if (!this.page) throw new Error('Engine not started');

    let targetY: number;
    if (typeof selectorOrY === 'number') {
      targetY = selectorOrY;
    } else {
      targetY = await this.page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) throw new Error(`Element not found for scrollTo: ${sel}`);
        const rect = el.getBoundingClientRect();
        return window.scrollY + rect.top;
      }, selectorOrY);
    }

    const startY = await this.page.evaluate(() => window.scrollY);
    const steps = Math.max(1, Math.round(durationSec * this.fps));

    for (let step = 1; step <= steps; step++) {
      const t = step / steps;
      const easedT = easing(t);
      const curY = startY + (targetY - startY) * easedT;

      await this.page.evaluate((y) => window.scrollTo(0, y), curY);
      this.currentScrollY = curY;

      await this.stepFrame();
    }

    await this.page.evaluate((y) => window.scrollTo(0, y), targetY);
    this.currentScrollY = targetY;
  }

  /**
   * Executa um clique de mouse: down, 4 quadros pressionado, up.
   */
  public async click(name = 'click'): Promise<void> {
    if (!this.page) throw new Error('Engine not started');

    this.currentCursor.down = true;
    this.currentCursor.pointer = 'mouse';
    await this.page.mouse.down();
    this.mark(name, 'click');

    for (let i = 0; i < 4; i++) {
      await this.stepFrame();
    }

    this.currentCursor.down = false;
    await this.page.mouse.up();

    // Se uma transição de tema foi disparada, aguarda transition.ready e requestAnimationFrame
    // para que ::view-transition-new(root) esteja montado com clip-path 0% antes do screenshot.
    await this.page.evaluate(async () => {
      const root = document.documentElement;
      if (root.dataset.themeReveal === 'active') {
        const trans = (window as unknown as { __themeTransition?: { ready: Promise<void> } }).__themeTransition;
        if (trans && typeof trans.ready?.then === 'function') {
          try {
            await trans.ready;
          } catch {}
        }
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      }
    });
  }

  /**
   * Executa um toque touch (mobile): move para o elemento, dispara tap, segura por 4 quadros.
   */
  public async tap(
    selectorOrPoint: string | { x: number; y: number },
    name?: string
  ): Promise<void> {
    if (!this.page) throw new Error('Engine not started');

    let targetX = 0;
    let targetY = 0;
    let eventName = name;

    if (typeof selectorOrPoint === 'string') {
      eventName = eventName ?? selectorOrPoint;
      const locator = this.page.locator(selectorOrPoint);
      const box = await locator.boundingBox();
      if (!box) {
        throw new Error(`Element not found for tap: ${selectorOrPoint}`);
      }
      targetX = box.x + box.width / 2;
      targetY = box.y + box.height / 2;
    } else {
      eventName = eventName ?? 'tap';
      targetX = selectorOrPoint.x;
      targetY = selectorOrPoint.y;
    }

    this.currentCursor.x = targetX;
    this.currentCursor.y = targetY;
    this.currentCursor.pointer = 'touch';
    this.currentCursor.down = true;

    this.mark(eventName, 'tap');

    if (typeof selectorOrPoint === 'string') {
      await this.page.tap(selectorOrPoint);
    } else {
      await this.page.touchscreen.tap(targetX, targetY);
    }

    for (let i = 0; i < 4; i++) {
      await this.stepFrame();
    }

    this.currentCursor.down = false;

    // Se uma transição de tema foi disparada, aguarda transition.ready e requestAnimationFrame
    await this.page.evaluate(async () => {
      const root = document.documentElement;
      if (root.dataset.themeReveal === 'active') {
        const trans = (window as unknown as { __themeTransition?: { ready: Promise<void> } }).__themeTransition;
        if (trans && typeof trans.ready?.then === 'function') {
          try {
            await trans.ready;
          } catch {}
        }
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      }
    });
  }

  /**
   * Pressiona uma tecla do teclado.
   */
  public async press(key: string): Promise<void> {
    if (!this.page) throw new Error('Engine not started');

    await this.page.keyboard.down(key);
    this.mark(key, 'key');
    await this.stepFrame();
    await this.stepFrame();

    await this.page.keyboard.up(key);
    await this.stepFrame();
  }

  /**
   * Digita um texto na velocidade especificada (caracteres por segundo).
   */
  public async type(text: string, cps = 8): Promise<void> {
    const delayPerChar = 1 / cps;
    for (const char of text) {
      await this.press(char);
      const extraTime = delayPerChar - 3 * (this.frameMs / 1000);
      if (extraTime > 0) {
        await this.record(extraTime);
      }
    }
  }

  /**
   * Descobre a posição exata (x, y em pixels CSS) de uma barra no gráfico ECharts.
   */
  public async getEChartsBarPosition(
    chartSelector: string,
    query: string
  ): Promise<{ x: number; y: number }> {
    if (!this.page) throw new Error('Engine not started');

    const point = await this.page.evaluate(
      async ({ selector, q }) => {
        const el = document.querySelector(selector);
        if (!el) throw new Error(`Chart element not found: ${selector}`);

        const chartsTs = await fetch('/src/scripts/charts.ts').then((r) => r.text());
        const match = chartsTs.match(/from\s+['"]([^'"]*echarts[^'"]*)['"]/);
        if (!match) throw new Error('Could not find echarts import in charts.ts');

        const echarts = await import(match[1]);
        const chart = echarts.getInstanceByDom(el);
        if (!chart) throw new Error(`getInstanceByDom returned null for ${selector}`);

        const opt = chart.getOption();
        const xLabels: string[] = opt.xAxis[0].data;
        const seriesData = opt.series[0].data;

        let index = xLabels.findIndex((l) => l.includes(q));
        if (index === -1) {
          index = xLabels.findIndex((l) => l.includes('2') && l.includes('5'));
        }
        if (index === -1) {
          throw new Error(`Bar not found for query: ${q} in [${xLabels.join(', ')}]`);
        }

        const dataItem = seriesData[index];
        const val = typeof dataItem === 'object' && dataItem !== null ? dataItem.value : dataItem;

        const chartPixel = chart.convertToPixel({ seriesIndex: 0 }, [index, (val ?? 50) / 2]);
        const rect = el.getBoundingClientRect();

        return {
          x: rect.left + chartPixel[0],
          y: rect.top + chartPixel[1],
        };
      },
      { selector: chartSelector, q: query }
    );

    return point;
  }

  /**
   * Registra um marcador de evento no timeline.
   */
  public mark(name: string, type: TimelineEvent['type'] = 'mark'): void {
    this.timeline.events.push({
      frame: this.currentFrame,
      type,
      name,
    });
  }

  /**
   * Finaliza a captura, fecha FFmpeg e Chromium, e grava o timeline.json.
   */
  public async close(): Promise<CloseResult> {
    const elapsedMs = performance.now() - this.captureStartTime;

    if (this.ffmpegProc) {
      this.ffmpegProc.stdin?.end();
      await new Promise<void>((resolve) => {
        if (!this.ffmpegProc) return resolve();
        this.ffmpegProc.on('close', () => resolve());
      });
      this.ffmpegProc = null;
    }

    if (this.cdpSession) {
      await this.cdpSession.detach().catch(() => {});
      this.cdpSession = null;
    }

    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
    }

    this.timeline.totalFrames = this.currentFrame;
    this.timeline.durationSeconds = this.currentFrame / this.fps;

    fs.writeFileSync(this.timelinePath, JSON.stringify(this.timeline, null, 2), 'utf-8');

    const avgMsPerFrame = this.currentFrame > 0 ? elapsedMs / this.currentFrame : 0;

    return {
      totalFrames: this.currentFrame,
      durationSeconds: this.timeline.durationSeconds,
      mp4Path: this.outputPath,
      timelinePath: this.timelinePath,
      elapsedMs,
      avgMsPerFrame,
    };
  }
}
