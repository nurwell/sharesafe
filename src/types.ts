export type Rect = { x: number; y: number; width: number; height: number };
export type Style = 'black' | 'neutral' | 'label';
export type Redaction = Rect & { id: string; style: Style };
export type TextSymbol = Rect & { text: string; confidence: number };
export type Word = Rect & { id: string; text: string; confidence: number; symbols?: TextSymbol[] };
export type Finding = { id: string; text: string; kind: string; rect: Rect };
export type Mode = 'quick' | 'developer';
export type Source = { canvas: HTMLCanvasElement; name: string; width: number; height: number; sample?: boolean };
