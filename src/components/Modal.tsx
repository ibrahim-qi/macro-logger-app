import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

import type { ReactNode } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  footer?: ReactNode;
  /** Full-height bottom sheet tuned for long scrollable content (meal review). */
  variant?: 'default' | 'sheet';
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
  footer,
  variant = 'default',
}) => {
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

  if (!isOpen) return null;

  const handleContentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const panelClass = variant === 'sheet'
    ? 'modal-panel modal-panel--sheet card-elevated'
    : 'modal-panel card-elevated';

  const bodyClass = variant === 'sheet'
    ? 'modal-body modal-body--sheet scrollbar-dark scroll-touch'
    : 'modal-body scrollbar-dark scroll-touch';

  return createPortal(
    <div
      className="modal-overlay safe-x"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div className={panelClass} onClick={handleContentClick}>
        {title && (
          <div className="modal-header">
            <h3 className="modal-header__title">{title}</h3>
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

        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
};

export default Modal;
