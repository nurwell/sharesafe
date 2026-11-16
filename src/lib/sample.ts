import type { Source, Word } from '../types';
export function makeSample(): { source: Source; words: Word[] } {
  const canvas = document.createElement('canvas'); canvas.width = 1100; canvas.height = 660;
  const c = canvas.getContext('2d')!;
  c.fillStyle = '#ffffff'; c.fillRect(0, 0, 1100, 660);
  c.fillStyle = '#f2f4ef'; c.fillRect(0, 0, 1100, 58);
  c.fillStyle = '#a6ae9a'; [28, 49, 70].forEach(x => { c.beginPath(); c.arc(x, 29, 5, 0, Math.PI * 2); c.fill(); });
  c.fillStyle = '#62695c'; c.font = '15px monospace'; c.fillText('project-notes / team conversation', 360, 35);
  c.fillStyle = '#171914'; c.font = 'bold 30px sans-serif'; c.fillText('A little context before we ship.', 58, 121);
  c.fillStyle = '#747c6c'; c.font = '16px sans-serif'; c.fillText('PRODUCT TEAM  /  TODAY, 10:42', 58, 158);
  const words: Word[] = [];
  const lines = [
    ['Maya', 'Hey! The preview is ready for a quick look.'],
    ['', 'Send your notes to maya@example.com'],
    ['Alex', 'Looks good. I’ll check the staging logs.'],
    ['', 'API_KEY=sk_example_not_a_real_secret'],
    ['Maya', 'Perfect. Same contact: maya@example.com'],
    ['', 'Let’s keep the details between us for now.'],
  ];
  lines.forEach(([name, line], index) => {
    const y = 222 + index * 61;
    if (name) { c.fillStyle = '#e8eddf'; c.beginPath(); c.roundRect(58, y - 23, 42, 42, 12); c.fill(); c.fillStyle = '#565b50'; c.font = 'bold 17px sans-serif'; c.fillText(name[0], 72, y + 3); }
    c.font = '20px monospace'; c.fillStyle = '#32392c'; let x = 122;
    line.split(' ').forEach((text, i) => {
      const width = c.measureText(text).width; c.fillText(text, x, y);
      const symbols = [...text].map((char, j) => ({ text: char, x: x + c.measureText(text.slice(0, j)).width, y: y - 20, width: c.measureText(char).width, height: 25, confidence: 100 }));
      words.push({ id: `sample-${index}-${i}`, text, x, y: y - 20, width, height: 25, confidence: 100, symbols }); x += width + c.measureText(' ').width;
    });
  });
  c.fillStyle = '#939a8b'; c.font = '14px sans-serif'; c.fillText('FICTIONAL SAMPLE · NO REAL SECRETS', 58, 623);
  return { source: { canvas, width: 1100, height: 660, name: 'fictional-team-chat.png', sample: true }, words };
}
