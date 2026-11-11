import { useRef, useState, type PointerEvent, type ReactNode } from 'react';

type Props = {
  /** decidedAt は指を離した時刻（performance.now）。カードが飛んでいく演出の後に呼ぶ */
  onDecide: (dir: 'left' | 'right', decidedAt: number) => void;
  leftHint: string;
  rightHint: string;
  children: ReactNode;
};

const THRESHOLD_RATIO = 0.25;
const FLY_MS = 160;

/** 左右にスワイプして判定するカード */
export function SwipeCard({ onDecide, leftHint, rightHint, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const [dx, setDx] = useState(0);
  const [flying, setFlying] = useState<'left' | 'right' | null>(null);

  const width = () => ref.current?.offsetWidth ?? 320;

  function onPointerDown(e: PointerEvent) {
    if (flying) return;
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    ref.current?.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent) {
    if (!start.current || start.current.id !== e.pointerId) return;
    setDx(e.clientX - start.current.x);
  }

  function onPointerUp(e: PointerEvent) {
    if (!start.current || start.current.id !== e.pointerId) return;
    start.current = null;
    if (Math.abs(dx) > width() * THRESHOLD_RATIO) {
      const dir = dx > 0 ? 'right' : 'left';
      const decidedAt = performance.now();
      setFlying(dir);
      setTimeout(() => onDecide(dir, decidedAt), FLY_MS);
    } else {
      setDx(0);
    }
  }

  const x = flying ? (flying === 'right' ? 1 : -1) * width() * 1.5 : dx;
  const ratio = Math.min(1, Math.abs(dx) / (width() * THRESHOLD_RATIO));

  return (
    <div
      ref={ref}
      className="card swipe-card"
      style={{
        transform: `translateX(${x}px) rotate(${x / 25}deg)`,
        transition: start.current ? 'none' : `transform ${FLY_MS}ms ease-out`,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <span className="hint left" style={{ opacity: dx < 0 ? ratio : 0 }}>
        {leftHint}
      </span>
      <span className="hint right" style={{ opacity: dx > 0 ? ratio : 0 }}>
        {rightHint}
      </span>
      {children}
    </div>
  );
}
