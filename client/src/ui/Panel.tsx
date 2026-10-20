import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { t } from '../strings/en';
import { useReducedMotion } from './motion';
import s from './Panel.module.css';

export interface PanelProps {
  title: string;
  /** Where the panel sits on the stage, in stage units. */
  x: number;
  y: number;
  width: number;
  height?: number;
  /** Which way it slides in from. */
  from?: 'left' | 'right' | 'top' | 'bottom';
  variant?: 'card' | 'kraft' | 'notebook';
  tilt?: number;
  onClose(): void;
  children: ReactNode;
  className?: string;
}

/**
 * Menus are index cards and folders that slide out onto the desk. Esc or the
 * paperclip puts them back; focus moves in and returns to the desk object.
 */
export function Panel({ title, x, y, width, height, from = 'left', variant = 'card', tilt = 0, onClose, children, className }: PanelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const offset = { left: { x: -140, y: 0 }, right: { x: 140, y: 0 }, top: { x: 0, y: -120 }, bottom: { x: 0, y: 140 } }[from];

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    ref.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      opener?.focus?.({ preventScroll: true });
    };
  }, [onClose]);

  const style: CSSProperties = { left: x, top: y, width, ...(height ? { height } : {}) };
  return (
    <motion.section
      ref={ref}
      className={`${s.panel} ${s[variant]} ${className ?? ''}`}
      style={style}
      role="dialog"
      aria-label={title}
      tabIndex={-1}
      initial={reduced ? { opacity: 0 } : { opacity: 0, x: offset.x, y: offset.y, rotate: tilt - 4 }}
      animate={{ opacity: 1, x: 0, y: 0, rotate: tilt }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, x: offset.x * 0.6, y: offset.y * 0.6, rotate: tilt - 3 }}
      transition={reduced ? { duration: 0.12 } : { type: 'spring', stiffness: 320, damping: 28 }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <header className={s.head}>
        <h2 className={s.title}>{title}</h2>
        <button type="button" className={s.clip} onClick={onClose} aria-label={t.desk.close} title={t.desk.close} />
      </header>
      <div className={s.body}>{children}</div>
    </motion.section>
  );
}
