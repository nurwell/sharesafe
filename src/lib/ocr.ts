import type { Word } from '../types';
type RawSymbol = { text: string; confidence: number; bbox: { x0: number; y0: number; x1: number; y1: number } };
type RawWord = RawSymbol & { symbols?: RawSymbol[] };
const geometry = (w: RawSymbol) => ({ text: w.text, confidence: w.confidence, x: w.bbox.x0, y: w.bbox.y0, width: w.bbox.x1 - w.bbox.x0, height: w.bbox.y1 - w.bbox.y0 });

// Adapter for Tesseract 6's bundled worker protocol. Owning the native Worker
// ensures initialization failures, timeouts, and cancellation release resources.
export async function recognize(canvas: HTMLCanvasElement, progress: (n: number) => void, signal?: AbortSignal): Promise<Word[]> {
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Could not read image.')), 'image/png'));
  if (signal?.aborted) throw new Error('Cancelled');
  const image = new Uint8Array(await blob.arrayBuffer());
  const worker = new Worker('/ocr/worker.min.js');
  const pending = new Map<string, { resolve: (value: unknown) => void; reject: (reason: Error) => void }>();
  const fail = (message: string) => { for (const job of pending.values()) job.reject(new Error(message)); pending.clear(); worker.terminate(); };
  const abort = () => fail('Cancelled');
  const job = (action: string, payload: object): Promise<unknown> => new Promise((resolve, reject) => {
    pending.set(action, { resolve, reject }); worker.postMessage({ workerId: 'local', jobId: action, action, payload });
  });
  worker.onerror = () => fail('Text recognition could not start.');
  worker.onmessageerror = () => fail('Text recognition failed.');
  worker.onmessage = ({ data }) => {
    if (data.status === 'progress') { if (data.data.status === 'recognizing text') progress(data.data.progress); return; }
    const entry = pending.get(data.action); if (!entry) return; pending.delete(data.action);
    if (data.status === 'reject') { entry.reject(new Error('Local OCR failed.')); worker.terminate(); } else entry.resolve(data.data);
  };
  signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => fail('Text recognition timed out. Try a smaller image.'), 90000);
  try {
    if (signal?.aborted) throw new Error('Cancelled');
    await job('load', { options: { lstmOnly: true, corePath: `${location.origin}/ocr`, logging: false } });
    await job('loadLanguage', { langs: 'eng', options: { langPath: `${location.origin}/ocr`, gzip: true, cacheMethod: 'none', lstmOnly: true } });
    await job('initialize', { langs: 'eng', oem: 1, config: {} });
    const data = await job('recognize', { image, options: {}, output: { text: true, blocks: true } }) as { blocks?: { paragraphs: { lines: { words: RawWord[] }[] }[] }[] };
    return (data.blocks ?? []).flatMap(b => b.paragraphs.flatMap(p => p.lines.flatMap(l => l.words))).map((w, i) => ({
      id: `word-${i}`, ...geometry(w), symbols: w.symbols?.map(geometry),
    })).filter(w => w.text.trim() && w.width > 0 && w.height > 0);
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); worker.terminate(); image.fill(0); pending.clear(); }
}
