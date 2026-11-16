import { useCallback, useEffect, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import type { Mode, Source, Word } from './types';
import { importImage } from './lib/import';
import { makeSample } from './lib/sample';
import Editor from './components/Editor';
import Landing from './components/Landing';
import { useEditor } from './store';

export default function App() {
  const [source, setSource] = useState<Source | null>(null);
  const [session, setSession] = useState(0);
  const [initialMode, setInitialMode] = useState<Mode>('quick');
  const [sampleWords, setSampleWords] = useState<Word[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const sourceRef = useRef(source); sourceRef.current = source;
  const busy = useRef(false);
  const open = useCallback(async (file: File) => {
    if (busy.current) return;
    busy.current = true; setLoading(true); setError('');
    try {
      const next = await importImage(file); const old = sourceRef.current;
      setSampleWords([]); useEditor.getState().reset(); setSession(n => n + 1); setSource(next);
      if (old) { old.canvas.width = 0; old.canvas.height = 0; }
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not open this image.'); }
    finally { busy.current = false; setLoading(false); }
  }, []);
  useEffect(() => {
    const paste = (e: ClipboardEvent) => {
      if (document.querySelector('dialog[open]')) return;
      const file = [...(e.clipboardData?.files ?? [])].find(f => f.type.startsWith('image/'));
      if (file) { e.preventDefault(); void open(file); }
    };
    const drop = (e: DragEvent) => {
      e.preventDefault(); setDragging(false);
      if (document.querySelector('dialog[open]')) return;
      const file = e.dataTransfer?.files[0]; if (file) void open(file);
    };
    const over = (e: DragEvent) => { e.preventDefault(); if (!document.querySelector('dialog[open]')) setDragging(true); };
    const leave = (e: DragEvent) => { if (!e.relatedTarget) setDragging(false); };
    window.addEventListener('paste', paste); window.addEventListener('drop', drop);
    window.addEventListener('dragover', over); window.addEventListener('dragleave', leave);
    return () => {
      window.removeEventListener('paste', paste); window.removeEventListener('drop', drop);
      window.removeEventListener('dragover', over); window.removeEventListener('dragleave', leave);
    };
  }, [open]);
  const demo = (developer = false) => {
    const sample = makeSample(); useEditor.getState().reset(); setInitialMode(developer ? 'developer' : 'quick');
    setSession(n => n + 1); setSource(sample.source); setSampleWords(sample.words); window.scrollTo(0, 0);
  };
  const close = () => {
    if (source) { source.canvas.width = 0; source.canvas.height = 0; }
    setSource(null); setSampleWords([]); useEditor.getState().reset();
  };
  return <>
    <input ref={input} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" aria-label="Choose a screenshot" onChange={e => { const file = e.target.files?.[0]; if (file) void open(file); e.target.value = ''; }}/>
    {source ? <Editor key={session} source={source} sampleWords={sampleWords} initialMode={initialMode} onClose={close} onOpen={() => input.current?.click()}/> : <Landing loading={loading} onOpen={() => input.current?.click()} onDemo={demo}/>}
    {error && <div className="global-error" role="alert">{error}<button onClick={() => setError('')} aria-label="Dismiss error">×</button></div>}
    {dragging && <div className="drop-overlay"><Upload size={48}/><h2>Drop your screenshot here.</h2><p>It stays on this device.</p></div>}
  </>;
}
