import * as cg from 'chessground/types';

type MouchEvent = Event & Partial<MouseEvent & TouchEvent>;


export const dispatchChessgroundResize = (): boolean =>
  document.body.dispatchEvent(new Event('chessground.resize'));

export const bindChessgroundResize = (f: () => void): void =>
  document.body.addEventListener('chessground.resize', f);

export default function resizeHandle(
  els: cg.Elements,
) {
  const el = document.createElement('cg-resize');
  els.container.appendChild(el);
  
  const startResize = (start: MouchEvent) => {
    start.preventDefault();
    
    const mousemoveEvent = start.type === 'touchstart' ? 'touchmove' : 'mousemove',
    mouseupEvent = start.type === 'touchstart' ? 'touchend' : 'mouseup',
    startPos = eventPosition(start)!
    
    
    const resize = (move: MouchEvent) => {
      const pos = eventPosition(move)!,
      delta = pos[0] - startPos[0] + pos[1] - startPos[1];

      let zoom = Math.round(Math.min(100, Math.max(0, 100 + delta / 10)));

      document.body.style.setProperty('--zoom', zoom.toString());
      window.dispatchEvent(new Event('resize'));

    };

    document.body.classList.add('resizing');

    document.addEventListener(mousemoveEvent, resize);

    document.addEventListener(
      mouseupEvent,
      () => {
        document.removeEventListener(mousemoveEvent, resize);
        document.body.classList.remove('resizing');
      },
      { once: true },
    );
  };

  el.addEventListener('touchstart', startResize, { passive: false });
  el.addEventListener('mousedown', startResize, { passive: false });

}

function eventPosition(e: MouchEvent): [number, number] | undefined {
  if (e.clientX || e.clientX === 0) return [e.clientX, e.clientY!];
  if (e.targetTouches?.[0]) return [e.targetTouches[0].clientX, e.targetTouches[0].clientY];
  return;
}
