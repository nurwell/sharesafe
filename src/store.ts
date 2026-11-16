import { create } from 'zustand';
import type { Redaction } from './types';
type State = { past: Redaction[][]; items: Redaction[]; future: Redaction[][]; commit: (items: Redaction[]) => void; undo: () => void; redo: () => void; reset: () => void };
export const useEditor = create<State>((set) => ({
  past: [], items: [], future: [],
  commit: (items) => set(s => ({ past: [...s.past.slice(-79), s.items], items, future: [] })),
  undo: () => set(s => s.past.length ? { past: s.past.slice(0, -1), items: s.past[s.past.length - 1], future: [s.items, ...s.future] } : s),
  redo: () => set(s => s.future.length ? { past: [...s.past, s.items], items: s.future[0], future: s.future.slice(1) } : s),
  reset: () => set({ past: [], items: [], future: [] }),
}));
