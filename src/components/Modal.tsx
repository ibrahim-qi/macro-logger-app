import React from 'react';
import type { ReactNode } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children, title }) => {
  if (!isOpen) return null;

  // Prevent clicks inside the modal content from closing it
  const handleContentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    // Overlay
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4 transition-opacity duration-300 ease-in-out"
      onClick={onClose} // Close when clicking the overlay
      aria-modal="true"
      role="dialog"
    >
      {/* Modal Content Container */}
      <div 
        className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[85vh] overflow-y-auto flex flex-col transform transition-all duration-300 ease-in-out scale-95 opacity-0 animate-modal-appear"
        onClick={handleContentClick}
      >
        {/* Modal Header (Optional Title + Close Button) */}
        {(title) && (
           <div className="flex items-center justify-between p-4 border-b border-gray-200 sticky top-0 bg-white z-10">
            <h3 className="text-xl font-semibold text-gray-800">{title}</h3>
            <button 
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 focus:outline-none ml-auto" // Ensure button is on the right even without title
              aria-label="Close modal"
            >
              <span className="material-icons-outlined">close</span>
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 flex-grow">
          {children}
        </div>
      </div>

      {/* Add Keyframes for animation in index.css or a global style sheet */}
      <style>{`
        @keyframes modal-appear {
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
        .animate-modal-appear {
          animation: modal-appear 0.3s forwards;
        }
      `}</style>
    </div>
  );
};

export default Modal; 