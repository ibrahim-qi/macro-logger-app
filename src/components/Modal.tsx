import React from 'react';

import type { ReactNode } from 'react';



interface ModalProps {

  isOpen: boolean;

  onClose: () => void;

  children: ReactNode;

  title?: string;

  footer?: ReactNode;

}



const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children, title, footer }) => {

  if (!isOpen) return null;



  const handleContentClick = (e: React.MouseEvent) => {

    e.stopPropagation();

  };



  return (

    <div

      className="modal-overlay safe-x"

      onClick={onClose}

      aria-modal="true"

      role="dialog"

    >

      <div

        className="modal-panel card-elevated"

        onClick={handleContentClick}

      >

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



        <div className="modal-body scrollbar-dark scroll-touch">{children}</div>



        {footer && (

          <div className="modal-footer">

            {footer}

          </div>

        )}

      </div>

    </div>

  );

};



export default Modal;

