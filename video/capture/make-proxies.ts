/**
 * Gera as versões leves das tomadas do chat usadas pelo Remotion.
 *
 * As tomadas saem em 3840×2160 (viewport 1920×1080 com escala 2), mas o vídeo só
 * mostra o painel do chat e, numa cena, os KPIs do painel. Recortar essas regiões
 * deixa a pré-visualização do Studio fluida (decodificar três 4K a 60 fps no
 * navegador trava e faz o player pular quadros) e acelera a renderização. GOP
 * curto para o Studio buscar quadros rápido nos cortes.
 *
 *   npx tsx capture/make-proxies.ts                  → public/chat/*.mp4 + *.timeline.json
 *   npx tsx capture/make-proxies.ts v2-compare:full  → só os recortes pedidos (tomada:recorte)
 */
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { DEFAULT_FFMPEG } from './engine';
import { PROXY_REGIONS, ProxyRegion } from '../src/chatUpgrade/footage/proxyRegions';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CAPTURES_DIR = path.resolve(__dirname, '..', 'captures');
const PUBLIC_DIR = path.resolve(__dirname, '..', 'public', 'chat');
const SCALE = 2;

fs.mkdirSync(PUBLIC_DIR, { recursive: true });

const only = process.argv.slice(2);
const wanted = (take: string, name: string) => only.length === 0 || only.includes(`${take}:${name}`);

for (const [take, regions] of Object.entries(PROXY_REGIONS)) {
  const source = path.join(CAPTURES_DIR, `chat-${take}.mp4`);
  if (!fs.existsSync(source)) throw new Error(`Tomada ausente: ${source}`);

  for (const [name, r] of Object.entries(regions) as [string, ProxyRegion][]) {
    if (!wanted(take, name)) continue;
    const out = path.join(PUBLIC_DIR, `chat-${take}-${name}.mp4`);
    let crop = `crop=${r.w * SCALE}:${r.h * SCALE}:${r.x * SCALE}:${r.y * SCALE}`;
    const outScale = r.outScale ?? SCALE;
    if (outScale !== SCALE) crop += `,scale=${r.w * outScale}:${r.h * outScale}:flags=lanczos`;
    const args = [
      '-v', 'error', '-y', '-i', source,
      '-vf', crop,
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '14',
      '-g', '30', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an',
      out,
    ];
    const res = spawnSync(DEFAULT_FFMPEG, args, { stdio: 'inherit' });
    if (res.status !== 0) throw new Error(`ffmpeg falhou em ${out}`);
    console.log(`${take}/${name}: ${r.w}×${r.h} css × ${outScale} → ${path.relative(process.cwd(), out)}`);
  }

  fs.copyFileSync(
    path.join(CAPTURES_DIR, `chat-${take}.timeline.json`),
    path.join(PUBLIC_DIR, `chat-${take}.timeline.json`),
  );
}
