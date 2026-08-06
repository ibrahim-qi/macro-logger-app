import React, { useEffect, useRef, useState } from 'react';
import { getTranscriptCorrectHint } from '../copy/experience';

interface TranscriptCorrectBlockProps {
  transcript: string;
  /** Eyebrow label — e.g. "We heard" / "You said" */
  label: string;
  canEdit: boolean;
  onCorrect?: (text: string) => void;
  /** Open already in edit mode (e.g. no_meal_detected recovery). */
  autoEdit?: boolean;
  /** Notify parent when inline editing starts/stops (hide competing chrome). */
  onEditingChange?: (editing: boolean) => void;
  /** Extra class on the outer wrapper */
  className?: string;
}

function isCoarsePointer(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
}

/**
 * Shared transcript display + inline correction.
 * Tap the quote to edit. Escape cancels; Ctrl/⌘+Enter applies on fine pointers.
 */
const TranscriptCorrectBlock: React.FC<TranscriptCorrectBlockProps> = ({
  transcript,
  label,
  canEdit,
  onCorrect,
  autoEdit = false,
  onEditingChange,
  className = '',
}) => {
  const trimmed = transcript.trim();
  const [editing, setEditing] = useState(Boolean(autoEdit && canEdit));
  const [draft, setDraft] = useState(trimmed);
  const [touchUi, setTouchUi] = useState(false);
  const syncedFromRef = useRef(trimmed);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autoEditAppliedRef = useRef(false);

  const setEditingState = (next: boolean) => {
    setEditing(next);
    onEditingChange?.(next);
  };

  useEffect(() => {
    setTouchUi(isCoarsePointer());
  }, []);

  useEffect(() => {
    if (!editing && trimmed !== syncedFromRef.current) {
      syncedFromRef.current = trimmed;
      setDraft(trimmed);
    }
  }, [editing, trimmed]);

  useEffect(() => {
    if (autoEdit && canEdit && trimmed && !autoEditAppliedRef.current) {
      autoEditAppliedRef.current = true;
      setDraft(trimmed);
      setEditing(true);
      onEditingChange?.(true);
      return;
    }
    if (!autoEdit) {
      autoEditAppliedRef.current = false;
    }
  }, [autoEdit, canEdit, trimmed, onEditingChange]);

  useEffect(() => {
    if (!editing) return;
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    const len = el.value.length;
    el.setSelectionRange(len, len);
    // Keep the field above the iOS keyboard inside the sheet.
    window.requestAnimationFrame(() => {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  }, [editing]);

  useEffect(() => {
    if (!canEdit && editing) {
      setEditing(false);
      onEditingChange?.(false);
    }
  }, [canEdit, editing, onEditingChange]);

  if (!trimmed) return null;

  const beginEdit = () => {
    if (!canEdit) return;
    setDraft(trimmed);
    setEditingState(true);
  };

  const cancelEdit = () => {
    setDraft(trimmed);
    setEditingState(false);
  };

  const applyCorrection = () => {
    const next = draft.trim();
    if (!next || !onCorrect) return;
    if (next === trimmed) {
      setEditingState(false);
      return;
    }
    setEditingState(false);
    onCorrect(next);
  };

  return (
    <div className={`transcript-correct ${editing ? 'transcript-correct--editing' : ''} ${className}`.trim()}>
      <div className="transcript-correct__header">
        <span className="transcript-correct__label">{editing ? 'Edit transcript' : label}</span>
        {canEdit && !editing && (
          <button
            type="button"
            className="transcript-correct__edit-btn"
            onClick={beginEdit}
          >
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <div className="transcript-correct__edit">
          <textarea
            ref={textareaRef}
            className="transcript-correct__input input-premium"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={Math.min(6, Math.max(2, Math.ceil(draft.length / 48)))}
            aria-label="Correct transcript"
            onFocus={(event) => {
              const el = event.currentTarget;
              window.setTimeout(() => {
                el.scrollIntoView({ block: 'center', behavior: 'smooth' });
              }, 250);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                cancelEdit();
                return;
              }
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                applyCorrection();
              }
            }}
          />
          <p className="transcript-correct__hint">{getTranscriptCorrectHint(touchUi)}</p>
          <div className="transcript-correct__actions">
            <button type="button" className="btn-ghost transcript-correct__action" onClick={cancelEdit}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary transcript-correct__action"
              onClick={applyCorrection}
              disabled={!draft.trim()}
            >
              Use correction
            </button>
          </div>
        </div>
      ) : canEdit ? (
        <button
          type="button"
          className="transcript-correct__text transcript-correct__text--editable"
          onClick={beginEdit}
          aria-label={`Edit transcript: ${trimmed}`}
        >
          {trimmed}
        </button>
      ) : (
        <p className="transcript-correct__text">{trimmed}</p>
      )}
    </div>
  );
};

export default TranscriptCorrectBlock;
