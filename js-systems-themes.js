// Ok renk temaları. "Desen" her bölümün kendi renkli paletini kullanır; diğerleri
// tek renkli klasik görünümdür. Oynanışı etkilemez; kilometre taşlarıyla açılır.

export const THEMES = [
  { id: 'pattern', name: 'Desen', unlock: null, mono: null },
  { id: 'graphite', name: 'Füme', unlock: { type: 'level', value: 25 }, mono: '#2B2E33' },
  { id: 'ink', name: 'Mürekkep', unlock: { type: 'level', value: 50 }, mono: '#2D3B73' },
  { id: 'pastel', name: 'Pastel', unlock: { type: 'achievement', value: 'daily_7' }, mono: null, pastel: true },
  { id: 'forest', name: 'Orman', unlock: { type: 'level', value: 100 }, mono: '#2F6B55' },
  { id: 'plum', name: 'Erik', unlock: { type: 'level', value: 150 }, mono: '#6A3B7C' },
  { id: 'copper', name: 'Bakır', unlock: { type: 'level', value: 250 }, mono: '#A0583A' },
  { id: 'onyx', name: 'Oniks', unlock: { type: 'level', value: 400 }, mono: '#111214' },
];

export const BASE_PALETTE = {
  board: '#FFFFFF',
  dot: '#C4C7CE',
  dotWin: '#9FD9BE',
  hint: '#3E86E0',
  hintNext: '#8E6FE0',
  blocked: '#E25B4B',
  queued: '#101014',
  particles: ['#F2706B', '#F2C14E', '#4FC27A', '#3E9BEA', '#9C7BEB'],
};

export function themeById(id) { return THEMES.find((t) => t.id === id) || THEMES[0]; }
