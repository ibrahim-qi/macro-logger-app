import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

import type { ReactNode } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  ariaLabel?: string;
  footer?: ReactNode;
  /** Full-height bottom sheet, compact bottom card while parsing, or default dialog. */
  variant?: 'default' | 'sheet' | 'sheet-compact' | 'sheet-compact-tall';
  /** Lighter footer styling for short waiting states. */
  footerTone?: 'default' | 'minimal';
}

let modalOpenCount = 0;

function lockPageScroll() {
  const shellMain = document.querySelector<HTMLElement>('.app-shell__main');
  if (shellMain) {
    shellMain.dataset.modalScrollTop = String(shellMain.scrollTop);
    shellMain.style.overflow = 'hidden';
  }
}

function unlockPageScroll() {
  const shellMain = document.querySelector<HTMLElement>('.app-shell__main');
  if (!shellMain) return;

  const previousScrollTop = Number(shellMain.dataset.modalScrollTop ?? '0');
  shellMain.style.overflow = '';
  delete shellMain.dataset.modalScrollTop;
  shellMain.scrollTop = previousScrollTop;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  children,
  title,
  ariaLabel,
  footer,
  variant = 'default',
  footerTone = 'default',
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();

  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    modalOpenCount += 1;
    document.body.classList.add('modal-open');
    lockPageScroll();

    return () => {
      modalOpenCount = Math.max(0, modalOpenCount - 1);
      if (modalOpenCount === 0) {
        document.body.classList.remove('modal-open');
        unlockPageScroll();
      }
    };
  }, [isOpen]);

  // Trap focus and handle Escape only when the modal opens/closes — not when
  // parent re-renders pass a new onClose callback (which would steal focus from inputs).
  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    const panel = panelRef.current;
    if (!panel) return;

    const getFocusable = () => Array.from(
      panel.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );

    const focusInitial = window.setTimeout(() => {
      const focusable = getFocusable();
      (focusable[0] ?? panel).focus();
    }, 0);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusable = getFocusable();
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);

    return () => {
      window.clearTimeout(focusInitial);
      document.removeEventListener('keydown', onKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleContentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const panelClass = [
    'modal-panel card-elevated',
    variant === 'sheet' || variant === 'sheet-compact' || variant === 'sheet-compact-tall'
      ? 'modal-panel--sheet'
      : '',
    variant === 'sheet-compact' ? 'modal-panel--sheet-compact' : '',
    variant === 'sheet-compact-tall' ? 'modal-panel--sheet-compact modal-panel--sheet-compact-tall' : '',
  ].filter(Boolean).join(' ');

  const bodyClass = [
    'modal-body scrollbar-dark scroll-touch',
    variant === 'sheet' || variant === 'sheet-compact' || variant === 'sheet-compact-tall'
      ? 'modal-body--sheet'
      : '',
    variant === 'sheet-compact' || variant === 'sheet-compact-tall' ? 'modal-body--sheet-compact' : '',
  ].filter(Boolean).join(' ');

  const footerClass = [
    'modal-footer',
    footerTone === 'minimal' ? 'modal-footer--minimal' : '',
  ].filter(Boolean).join(' ');

  return createPortal(
    <div
      className="modal-overlay safe-x"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
      aria-label={!title ? ariaLabel : undefined}
      aria-labelledby={title ? titleId : undefined}
    >
      <div ref={panelRef} className={panelClass} onClick={handleContentClick} tabIndex={-1}>
        {title && (
          <div className="modal-header">
            <h3 id={titleId} className="modal-header__title">{title}</h3>
            <button
              onClick={onClose}
              className="modal-header__close"
              aria-label="Close modal"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        <div className={bodyClass}>{children}</div>

        {footer && <div className={footerClass}>{footer}</div>}
      </div>
    </div>,
    document.body,
  );
};

export default Modal;
