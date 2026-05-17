const LEAF_SVG = `<svg viewBox="0 0 16 22" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
  <path d="M8 1C4.8 1 2 4.6 2 9.5C2 15 4.8 20.2 8 21.4C11.2 20.2 14 15 14 9.5C14 4.6 11.2 1 8 1Z"/>
  <line x1="8" y1="1.5" x2="8" y2="21"  stroke="currentColor" stroke-width="0.7" opacity="0.4"/>
  <line x1="8" y1="8"   x2="5" y2="6"   stroke="currentColor" stroke-width="0.5" opacity="0.3"/>
  <line x1="8" y1="11"  x2="11" y2="9"  stroke="currentColor" stroke-width="0.5" opacity="0.3"/>
  <line x1="8" y1="14"  x2="5" y2="12"  stroke="currentColor" stroke-width="0.5" opacity="0.3"/>
</svg>`;

const wrapper = document.createElement('div');
wrapper.className = 'leaves-bg';
wrapper.setAttribute('aria-hidden', 'true');
document.body.prepend(wrapper);

for (let i = 0; i < 13; i++) {
  const el = document.createElement('div');
  el.className = 'leaf';
  el.innerHTML = LEAF_SVG;

  const x       = Math.random() * 98;
  const dur     = 11 + Math.random() * 10;
  const delay   = -(Math.random() * dur);
  const size    = 16 + Math.random() * 14;
  const rot     = Math.random() * 360;
  const sway    = (Math.random() < 0.5 ? 1 : -1) * (30 + Math.random() * 60);
  const opacity = 0.22 + Math.random() * 0.18;

  el.style.cssText = `
    left:${x.toFixed(1)}%;
    --dur:${dur.toFixed(1)}s;
    --delay:${delay.toFixed(1)}s;
    --size:${size.toFixed(0)}px;
    --rot:${rot.toFixed(0)}deg;
    --sway:${sway.toFixed(0)}px;
    --opacity:${opacity.toFixed(2)};
  `;

  wrapper.appendChild(el);
}
