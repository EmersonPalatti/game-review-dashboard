/**
 * Grava uma resposta real de POST /api/chat/stream (AG-UI) com o tempo de cada
 * pedaço do SSE, para a captura reproduzir depois sem chamar o modelo de novo.
 *
 *   npx tsx capture/record-stream.ts <nome> "<pergunta>"
 *   → capture/fixtures/<nome>.stream.json
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURES_DIR = path.resolve(__dirname, 'fixtures');
const API = 'http://127.0.0.1:8000/api/chat/stream';

interface Chunk {
  /** ms desde o envio da pergunta */
  t: number;
  data: string;
}

async function main(): Promise<void> {
  const [name, question] = process.argv.slice(2);
  if (!name || !question) {
    console.error('Uso: npx tsx capture/record-stream.ts <nome> "<pergunta>"');
    process.exit(1);
  }

  // Mesmo formato que o HttpAgent do frontend envia (RunAgentInput).
  const body = {
    threadId: 'steam-dashboard-session',
    runId: `run_${Date.now()}`,
    state: {},
    messages: [{ id: `user_${Date.now()}`, role: 'user', content: question }],
    tools: [],
    context: [],
    forwardedProps: { filters: {} },
  };

  const started = performance.now();
  const response = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify(body),
  });
  if (!response.ok || !response.body) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }

  const chunks: Chunk[] = [];
  const decoder = new TextDecoder();
  const reader = response.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push({ t: Math.round(performance.now() - started), data: decoder.decode(value, { stream: true }) });
  }

  const raw = chunks.map((c) => c.data).join('');
  const events = raw
    .split('\n\n')
    .map((block) => block.replace(/^data: /, '').trim())
    .filter(Boolean)
    .map((json) => {
      try {
        return JSON.parse(json) as Record<string, unknown>;
      } catch {
        return null;
      }
    })
    .filter((e): e is Record<string, unknown> => e !== null);

  fs.mkdirSync(FIXTURES_DIR, { recursive: true });
  const out = path.join(FIXTURES_DIR, `${name}.stream.json`);
  fs.writeFileSync(
    out,
    JSON.stringify({ question, contentType: response.headers.get('content-type'), chunks }, null, 1),
    'utf-8',
  );

  const total = chunks.length ? chunks[chunks.length - 1].t : 0;
  console.log(`${events.length} eventos, ${chunks.length} pedaços, ${(total / 1000).toFixed(1)} s → ${out}`);
  const tools = events.filter((e) => e.type === 'TOOL_CALL_START').map((e) => e.toolCallName);
  console.log('ferramentas:', tools.join(', '));
  for (const e of events.filter((e) => e.type === 'CUSTOM')) {
    const value = e.value as Record<string, unknown>;
    if (e.name === 'tool_timing') continue;
    if (e.name === 'genui_widget') console.log('widget:', value.type, '·', value.title);
    else if (e.name === 'dashboard_actions') console.log('ações:', JSON.stringify(value).slice(0, 400));
    else console.log('custom:', e.name);
  }
  const text = events
    .filter((e) => e.type === 'TEXT_MESSAGE_CONTENT')
    .map((e) => e.delta)
    .join('');
  console.log(`texto (${text.length} chars):\n${text.slice(0, 700)}`);
  const errors = events.filter((e) => e.type === 'RUN_ERROR');
  if (errors.length) console.log('ERROS:', JSON.stringify(errors));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
