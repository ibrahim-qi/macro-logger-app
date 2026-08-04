import React from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from './Modal';
import { getMicIntroBody, getMicIntroCta, getMicIntroTitle } from '../copy/experience';
import { hapticLight } from '../utils/haptics';

interface MicIntroModalProps {
  isOpen: boolean;
  onComplete: () => void;
}

const MicIntroModal: React.FC<MicIntroModalProps> = ({ isOpen, onComplete }) => {
  const navigate = useNavigate();

  const handleTryMic = () => {
    hapticLight();
    onComplete();
    navigate('/log');
  };

  return (
    <Modal isOpen={isOpen} onClose={() => {}} title={getMicIntroTitle()}>
      <div className="space-y-5">
        <p className="type-body-sm text-[var(--color-text-secondary)] leading-relaxed">
          {getMicIntroBody()}
        </p>
        <button type="button" onClick={handleTryMic} className="btn-primary w-full">
          {getMicIntroCta()}
        </button>
        <button
          type="button"
          onClick={onComplete}
          className="btn-ghost w-full py-3 text-[var(--color-text-muted)]"
        >
          Skip for now
        </button>
      </div>
    </Modal>
  );
};

export default MicIntroModal;
