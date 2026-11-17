import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Info } from 'lucide-react';

type ChartFrameProps = { label: string; guide: string; cue?: string; children: ReactNode };

/** Local, authored UI only. No chart or file values leave the component. */
export function ChartFrame({label, guide, cue, children}: ChartFrameProps) {
  const id = useId();
  const owner = useRef<HTMLSpanElement>(null);
  const [preview, setPreview] = useState(false);
  const [pinned, setPinned] = useState(false);
  const open = preview || pinned;
  const close = () => { setPinned(false); setPreview(false); };
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!owner.current?.contains(event.target as Node)) close(); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside, true); document.removeEventListener('keydown', escape); };
  }, [open]);
  return <div className="atlas-chart-frame">
    <div className="atlas-figure-key">
      <span className="atlas-cue">{cue || label}</span>
      <span className="atlas-guide-owner" ref={owner}
        onPointerEnter={e => { if (e.pointerType === 'mouse' || e.pointerType === 'pen') setPreview(true); }}
        onPointerLeave={() => setPreview(false)}>
        <button type="button" className="atlas-info" aria-label={`차트 읽는 법: ${label}`}
          aria-expanded={open} aria-controls={id} aria-describedby={open ? id : undefined}
          onFocus={e => { if(e.currentTarget.matches(':focus-visible')) setPreview(true); }}
          onBlur={close} onClick={() => { if (pinned) close(); else setPinned(true); }}>
          <Info size={17} strokeWidth={1.65} aria-hidden="true"/><span>읽는 법</span>
        </button>
        <span className="atlas-guide-tip" id={id} role="tooltip" hidden={!open}>
          <strong>차트 읽는 법</strong>{guide}
        </span>
      </span>
    </div>
    {children}
  </div>;
}
