import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CAPTURES_DIR = path.resolve(__dirname, '..', 'captures');
const REVIEW_DIR = path.resolve(CAPTURES_DIR, 'review');

const WINGET_FFMPEG =
  'C:\\Users\\enama\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-9.0.2-full_build\\bin\\ffmpeg.exe';
const WINGET_FFPROBE =
  'C:\\Users\\enama\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-9.0.2-full_build\\bin\\ffprobe.exe';

const FFMPEG =
  process.env.FFMPEG_PATH || (fs.existsSync(WINGET_FFMPEG) ? WINGET_FFMPEG : 'ffmpeg');
const FFPROBE =
  process.env.FFPROBE_PATH || (fs.existsSync(WINGET_FFPROBE) ? WINGET_FFPROBE : 'ffprobe');

interface TimelineEvent {
  frame: number;
  type: string;
  name: string;
}

interface TimelineData {
  fps: number;
  width: number;
  height: number;
  totalFrames: number;
  durationSeconds: number;
  events: TimelineEvent[];
}

function runCmd(cmd: string): string {
  return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
}

function probeVideo(mp4Path: string) {
  const jsonStr = runCmd(
    `"${FFPROBE}" -v quiet -print_format json -show_streams -show_format "${mp4Path}"`
  );
  const data = JSON.parse(jsonStr);
  const videoStream = data.streams.find((s: any) => s.codec_type === 'video');
  return {
    width: videoStream.width,
    height: videoStream.height,
    r_frame_rate: videoStream.r_frame_rate,
    avg_frame_rate: videoStream.avg_frame_rate,
    nb_frames: Number(videoStream.nb_frames || data.format.duration * 60),
    duration: Number(data.format.duration),
  };
}

function generateContactSheet(mp4Path: string, outPng: string, tileGrid: string, scaleWidth = 640) {
  const filter = `fps=2,scale=${scaleWidth}:-1,tile=${tileGrid}`;
  const cmd = `"${FFMPEG}" -y -i "${mp4Path}" -vf "${filter}" -frames:v 1 "${outPng}"`;
  console.log(`Generating contact sheet: ${outPng}`);
  execSync(cmd, { stdio: 'inherit' });
}

function extractFrame(mp4Path: string, frameNumber: number, outPng: string) {
  const cmd = `"${FFMPEG}" -y -i "${mp4Path}" -vf "select=eq(n\\,${frameNumber})" -vframes 1 "${outPng}"`;
  execSync(cmd, { stdio: 'inherit' });
}

async function reviewTake(videoName: 'desktop' | 'mobile', tileGrid: string, scaleWidth: number) {
  const mp4Path = path.resolve(CAPTURES_DIR, `${videoName}.mp4`);
  const timelinePath = path.resolve(CAPTURES_DIR, `${videoName}.timeline.json`);

  if (!fs.existsSync(mp4Path) || !fs.existsSync(timelinePath)) {
    throw new Error(`Arquivos não encontrados para ${videoName}: ${mp4Path}`);
  }

  const probe = probeVideo(mp4Path);
  console.log(`\n=== FFPROBE ${videoName.toUpperCase()} ===`);
  console.log(`Resolução: ${probe.width}x${probe.height}`);
  console.log(`Taxa de quadros: ${probe.r_frame_rate}`);
  console.log(`Total de quadros: ${probe.nb_frames}`);
  console.log(`Duração: ${probe.duration.toFixed(3)}s`);

  // Gera contact sheet
  const sheetPng = path.resolve(REVIEW_DIR, `${videoName}_sheet.png`);
  generateContactSheet(mp4Path, sheetPng, tileGrid, scaleWidth);

  // Lê timeline e marks
  const timeline: TimelineData = JSON.parse(fs.readFileSync(timelinePath, 'utf-8'));
  const marks = timeline.events.filter((e) => e.type === 'mark');

  console.log(`\n=== TABELA DE MARKS - ${videoName.toUpperCase()} ===`);
  console.log('| Cena (Mark) | Frame Inicial | Tempo (s) | Frame Central Extraído | PNG Gerado |');
  console.log('|---|---|---|---|---|');

  const rows: Array<{
    name: string;
    startFrame: number;
    startSec: string;
    midFrame: number;
    pngPath: string;
  }> = [];

  for (let i = 0; i < marks.length; i++) {
    const mark = marks[i];
    const nextMark = marks[i + 1];
    const endFrame = nextMark ? nextMark.frame : timeline.totalFrames;
    const midFrame = Math.round((mark.frame + endFrame) / 2);
    const startSec = (mark.frame / timeline.fps).toFixed(2);

    const markPng = path.resolve(REVIEW_DIR, `${mark.name}.png`);
    extractFrame(mp4Path, midFrame, markPng);

    rows.push({
      name: mark.name,
      startFrame: mark.frame,
      startSec,
      midFrame,
      pngPath: markPng,
    });

    console.log(
      `| \`${mark.name}\` | ${mark.frame} | ${startSec}s | frame ${midFrame} | \`${path.basename(markPng)}\` |`
    );
  }

  return { probe, rows, sheetPng };
}

async function main() {
  if (!fs.existsSync(REVIEW_DIR)) {
    fs.mkdirSync(REVIEW_DIR, { recursive: true });
  }

  console.log('Iniciando revisão e verificação visual...');

  // Desktop: ~20-25s -> ~40-50 frames @ 2fps. Grid 6x8 = 48 quadros
  const desktopReview = await reviewTake('desktop', '6x8', 426);

  // Mobile: ~6-8s -> ~12-16 frames @ 2fps. Grid 4x4 = 16 quadros
  const mobileReview = await reviewTake('mobile', '4x4', 300);

  console.log('\n=== REVISÃO COMPLETA CONCLUÍDA! ===\n');
}

main().catch((err) => {
  console.error('Erro na revisão:', err);
  process.exit(1);
});
