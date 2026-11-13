'use client';

import { useRef, useState, useCallback, useEffect } from 'react';

type SlideState = 'idle' | 'dragging' | 'countdown' | 'done';

interface Props {
  label: string;
  onConfirm: () => void;
  disabled?: boolean;
  color?: 'red' | 'green';
}

const COUNTDOWN_MS = 3000;
const THUMB_W      = 56; // px
const TRACK_PAD    = 4;  // px

export default function SlideButton({ label, onConfirm, disabled, color = 'red' }: Props) {
  const trackRef  = useRef<HTMLDivElement>(null);
  const thumbRef  = useRef<HTMLDivElement>(null);

  const [state,      setState]      = useState<SlideState>('idle');
  const [fillPct,    setFillPct]    = useState(0);
  const [countdown,  setCountdown]  = useState(COUNTDOWN_MS);

  const startXRef      = useRef(0);
  const countdownRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownMsRef = useRef(COUNTDOWN_MS);

  const trackColor = color === 'green' ? 'bg-green-600' : 'bg-eif-red';
  const fillColor  = color === 'green' ? 'bg-green-700' : 'bg-eif-red-dark';

  function reset() {
    clearCountdown();
    setState('idle');
    setFillPct(0);
    setCountdown(COUNTDOWN_MS);
    countdownMsRef.current = COUNTDOWN_MS;
  }

  function clearCountdown() {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }

  const startCountdown = useCallback(() => {
    setState('countdown');
    countdownMsRef.current = COUNTDOWN_MS;
    setCountdown(COUNTDOWN_MS);

    countdownRef.current = setInterval(() => {
      countdownMsRef.current -= 100;
      setCountdown(countdownMsRef.current);

      if (countdownMsRef.current <= 0) {
        clearCountdown();
        setState('done');
        onConfirm();
      }
    }, 100);
  }, [onConfirm]);

  function getTrackWidth() {
    return (trackRef.current?.clientWidth ?? 300) - THUMB_W - TRACK_PAD * 2;
  }

  function computeFill(clientX: number) {
    const max = getTrackWidth();
    const dx  = Math.max(0, Math.min(clientX - startXRef.current, max));
    return dx / max;
  }

  // ── Pointer events ──────────────────────────────────────────────
  function onPointerDown(e: React.PointerEvent) {
    if (disabled || state === 'done') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    reset();
    setState('dragging');
    startXRef.current = e.clientX - 0; // start from thumb left = 0
    // Adjust start so fill begins at 0 from wherever thumb is
    const thumbLeft = TRACK_PAD;
    startXRef.current = e.clientX - thumbLeft;
  }

  function onPointerMove(e: React.PointerEvent) {
    if (state !== 'dragging' && state !== 'countdown') return;
    const fill = computeFill(e.clientX);
    setFillPct(fill);

    if (fill >= 0.98) {
      if (state === 'dragging') startCountdown();
    } else {
      if (state === 'countdown') {
        clearCountdown();
        setState('dragging');
      }
    }
  }

  function onPointerUp() {
    if (state === 'dragging') reset();
    if (state === 'countdown') reset(); // lift before 3s = cancel
  }

  useEffect(() => () => clearCountdown(), []);

  // ── Visual ──────────────────────────────────────────────────────
  const thumbX = fillPct * getTrackWidth();

  const arcPct  = state === 'countdown' ? 1 - countdown / COUNTDOWN_MS : 0;
  const radius  = 20;
  const circum  = 2 * Math.PI * radius;
  const offset  = circum * (1 - arcPct);

  const isDone = state === 'done';

  return (
    <div
      ref={trackRef}
      className={`relative h-16 rounded-full select-none overflow-hidden
                  ${trackColor} ${disabled ? 'opacity-50' : ''}`}
    >
      {/* Fill bar */}
      <div
        className={`absolute inset-y-0 left-0 ${fillColor} rounded-full transition-none`}
        style={{ width: `calc(${TRACK_PAD}px + ${THUMB_W}px + ${fillPct * getTrackWidth()}px)` }}
      />

      {/* Label */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className="text-white/80 font-semibold text-sm tracking-wide">
          {isDone ? '✓ Registrado!' : state === 'countdown'
            ? `Aguarde ${(countdown / 1000).toFixed(1)}s`
            : label}
        </span>
      </div>

      {/* Thumb */}
      {!isDone && (
        <div
          ref={thumbRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{
            position: 'absolute',
            top: TRACK_PAD,
            left: TRACK_PAD + thumbX,
            width:  THUMB_W,
            height: THUMB_W,
            touchAction: 'none',
            cursor: disabled ? 'default' : 'grab',
          }}
          className="bg-white rounded-full shadow-md flex items-center justify-center"
        >
          {state === 'countdown' ? (
            <svg width={THUMB_W} height={THUMB_W} style={{ transform: 'rotate(-90deg)' }}>
              <circle cx={THUMB_W / 2} cy={THUMB_W / 2} r={radius}
                stroke="#e5e7eb" strokeWidth={4} fill="none" />
              <circle cx={THUMB_W / 2} cy={THUMB_W / 2} r={radius}
                stroke={color === 'green' ? '#16a34a' : '#BF2626'}
                strokeWidth={4} fill="none"
                strokeDasharray={circum}
                strokeDashoffset={offset}
                strokeLinecap="round"
                className="countdown-arc"
              />
            </svg>
          ) : (
            <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#BF2626" strokeWidth={2.5}>
              <polyline points="9 18 15 12 9 6" />
            </svg>
          )}
        </div>
      )}
    </div>
  );
}
