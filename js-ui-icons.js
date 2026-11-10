// Tek tip çizgi ikon seti (24×24, 1.8 kalınlık, yuvarlak uçlar). Hepsi bu projeye özgü.

const S = (body, extra = '') =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${body}</svg>`;

export const icon = {
  back: S('<path d="M15 5l-7 7 7 7"/>'),
  close: S('<path d="M6 6l12 12M18 6L6 18"/>'),
  settings: S('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  play: S('<path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none"/>'),
  grid: S('<rect x="4" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6"/>'),
  chart: S('<path d="M5 19V11M12 19V5M19 19v-6"/>'),
  calendar: S('<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M8 3v4M16 3v4M4 10h16"/><path d="M9.5 15l1.8 1.8 3.5-3.6"/>'),
  calendarPlain: S('<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M8 3v4M16 3v4M4 10h16"/><circle cx="12" cy="15" r="1.4" fill="currentColor" stroke="none"/>'),
  undo: S('<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>'),
  restart: S('<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4 4v4h4"/>'),
  hint: S('<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2V16h5.2v-.2c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/>'),
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.8l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 16.8l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>',
  lock: S('<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>'),
  moves: S('<path d="M5 12h11"/><path d="M12 7l5 5-5 5"/><path d="M20 5v14"/>'),
  sound: S('<path d="M4 9.5v5h3.5L12 19V5L7.5 9.5z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>'),
  music: S('<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>'),
  vibrate: S('<rect x="8" y="4" width="8" height="16" rx="2"/><path d="M4 9v6M20 9v6"/>'),
  motion: S('<path d="M4 12h3l2-5 4 10 2-5h5"/>'),
  trash: S('<path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13"/>'),
  info: S('<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8v.2"/>'),
  medal: S('<circle cx="12" cy="14" r="5.5"/><path d="M8.5 9.6L6 3h4l2 4 2-4h4l-2.5 6.6"/>'),
  check: S('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  chevron: S('<path d="M9 5l7 7-7 7"/>'),
  next: S('<path d="M5 12h13M13 6l6 6-6 6"/>'),
  ad: S('<rect x="3.5" y="5.5" width="17" height="13" rx="3"/><path d="M10 9.5v5l4.5-2.5z" fill="currentColor"/>'),
  gift: S('<rect x="4" y="9" width="16" height="11" rx="2"/><path d="M3 9h18M12 9v11"/><path d="M12 9c-1.5-3.5-6-4-6-1.5S9.5 9 12 9zM12 9c1.5-3.5 6-4 6-1.5S14.5 9 12 9z"/>'),
  palette: S('<path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.2 0 1.8-.8 1.8-1.7 0-1.2-1-1.5-1-2.6 0-1 .8-1.7 1.8-1.7h2a3.9 3.9 0 0 0 3.9-3.9C20.5 6.9 16.7 3.5 12 3.5z"/><circle cx="7.8" cy="11" r="1.1" fill="currentColor"/><circle cx="10.5" cy="7.5" r="1.1" fill="currentColor"/><circle cx="15" cy="7.8" r="1.1" fill="currentColor"/>'),
  home: S('<path d="M4 11l8-6.5 8 6.5"/><path d="M6.5 9.5V19h11V9.5"/><path d="M10 19v-5h4v5"/>'),
  trophy: S('<path d="M8 4h8v5a4 4 0 0 1-8 0V4z"/><path d="M8 6H5v1.5A3 3 0 0 0 8 10.5M16 6h3v1.5a3 3 0 0 1-3 3"/><path d="M12 13v4M8.5 20h7M10 17h4v3h-4z"/>'),
  bolt: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M13.5 2.5 4.5 13.5h6l-1 8 9-11h-6l1-8z"/></svg>',
  heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 21s-7.5-4.6-9.6-9.3C.9 8.1 3 4.5 6.6 4.5c2.1 0 3.6 1.1 5.4 3.1 1.8-2 3.3-3.1 5.4-3.1 3.6 0 5.7 3.6 4.2 7.2C19.5 16.4 12 21 12 21z"/></svg>',
  plus: S('<path d="M12 5.5v13M5.5 12h13"/>'),
  minus: S('<path d="M5.5 12h13"/>'),
  fit: S('<path d="M4.5 9V4.5H9M15 4.5h4.5V9M19.5 15v4.5H15M9 19.5H4.5V15"/>'),
  arrowUp: S('<path d="M12 18.5V6M6.5 11L12 5.5 17.5 11"/>', 'stroke-width="2.6"'),
};

/** Oyun para birimi: "ışık" — küçük pastel elmas. */
export const gem = `<svg class="gem" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l7.5 9L12 21 4.5 12z" fill="#C6D9F1"/><path d="M12 3l7.5 9H4.5z" fill="#D9D0F2"/><path d="M12 3l3.4 9L12 21l-3.4-9z" fill="#fff" opacity=".55"/><path d="M12 3l7.5 9L12 21 4.5 12z" fill="none" stroke="#5E6168" stroke-width="1.2" stroke-linejoin="round"/></svg>`;

/** Özgün logo işareti: çıkışa yönelen füme bir ok parçası ve arkasında iz bırakan iki pastel parça. */
export const logoMark = `<svg viewBox="0 0 40 40" aria-hidden="true">
  <rect x="2" y="22" width="13" height="13" rx="3.6" fill="#D9D0F2"/>
  <rect x="9" y="13" width="13" height="13" rx="3.6" fill="#C6D9F1"/>
  <rect x="17" y="4" width="19" height="19" rx="5.2" fill="#24262B" transform="translate(0 1.2)"/>
  <rect x="17" y="4" width="19" height="19" rx="5.2" fill="#31343A"/>
  <path d="M22.5 17.5l6-6M23.6 11.2h5.1v5.1" stroke="#F6F5F2" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
</svg>`;
