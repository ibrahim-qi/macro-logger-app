import React, { useState } from 'react';
import Modal from './Modal';
import { getNameSetupBody } from '../copy/experience';

interface NameSetupModalProps {
  isOpen: boolean;
  onSave: (name: string) => Promise<void>;
}

const NameSetupModal: React.FC<NameSetupModalProps> = ({ isOpen, onSave }) => {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('What should we call you?');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await onSave(trimmed);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save your name.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={() => {}} title="Welcome to Sahha">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="type-body-sm text-[var(--color-text-secondary)] leading-relaxed">
          {getNameSetupBody()}
        </p>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your first name"
          autoComplete="given-name"
          autoFocus
          className="input-premium"
        />
        {error && (
          <div className="alert-error">{error}</div>
        )}
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Saving…' : 'Continue'}
        </button>
      </form>
    </Modal>
  );
};

export default NameSetupModal;
