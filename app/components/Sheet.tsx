'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft } from 'lucide-react';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  /** Page fills the screen and goes back from the header. Vault is a tall sheet. */
  size?: 'default' | 'vault' | 'page';
  /** The child draws its own header and close control. */
  bare?: boolean;
  children: ReactNode;
}

export function Sheet({ open, onClose, title, eyebrow, size = 'default', bare = false, children }: SheetProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = () => dialogRef.current?.querySelector<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    window.requestAnimationFrame(() => focusable()?.focus());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const items = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )).filter((item) => item.offsetParent !== null);
      if (items.length === 0) {
        e.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      previousFocus?.focus();
    };
  }, [open]);

  if (!open) return null;

  const page = size === 'page';

  const dialog = (
    <div className={page ? 'sheet-backdrop is-page' : 'sheet-backdrop'} onClick={page ? undefined : onClose}>
      <div
        ref={dialogRef}
        className={`${page ? 'sheet sheet-page' : size === 'vault' ? 'sheet sheet-vault' : 'sheet'}${bare ? ' sheet-bare' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        {bare ? <h2 id={titleId} className="sheet-bare-title">{title}</h2> : null}
        {page || bare ? null : <div className="sheet-handle" />}
        {bare ? null : <div className="sheet-head">
          {page ? (
            <button className="sheet-back" onClick={onClose} aria-label="Back">
              <ArrowLeft size={20} />
            </button>
          ) : null}
          <div>
            {eyebrow && <p className="sheet-eyebrow">{eyebrow}</p>}
            <h2 className="sheet-title" id={titleId}>{title}</h2>
          </div>
          {page ? null : (
            <button className="sheet-close" onClick={onClose} aria-label="Close">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>}
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );

  if (bare && mounted) return createPortal(dialog, document.body);
  return dialog;
}
