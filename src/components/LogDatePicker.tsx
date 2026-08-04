import React, { useState } from 'react';
import { formatLocalDateKey, parseLocalDateKey } from '../utils/localDate';

interface LogDatePickerProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  className?: string;
  variant?: 'chip' | 'pill';
}

function formatDateForDisplay(date: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

function formatDateForPill(date: Date): string {
  const label = formatDateForDisplay(date);
  const detail = date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  if (label === 'Today') return `Today · ${detail}`;
  if (label === 'Yesterday') return `Yesterday · ${detail}`;
  return detail;
}

function formatDateForInput(date: Date): string {
  return formatLocalDateKey(date);
}

const LogDatePicker: React.FC<LogDatePickerProps> = ({
  selectedDate,
  onDateChange,
  className = '',
  variant = 'chip',
}) => {
  const [open, setOpen] = useState(false);
  const displayLabel = variant === 'pill'
    ? formatDateForPill(selectedDate)
    : formatDateForDisplay(selectedDate);
  const isToday = formatDateForDisplay(selectedDate) === 'Today';

  const triggerClass = variant === 'pill'
    ? `log-date-pill ${isToday ? 'log-date-pill--today' : ''} ${className}`.trim()
    : `date-chip ${isToday ? 'date-chip--today' : ''} ${className}`.trim();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={triggerClass}
        aria-label={`Logging for ${displayLabel}. Change date.`}
      >
        <svg className="log-date-pill__icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span>{displayLabel}</span>
        {variant === 'pill' && (
          <svg className="log-date-pill__chevron" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {open && (
        <div className="modal-overlay safe-x z-[110]" onClick={() => setOpen(false)}>
          <div className="modal-panel card-elevated p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-header__title mb-4">Log for</h3>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {(['Today', 'Yesterday'] as const).map((label) => {
                const isActive = formatDateForDisplay(selectedDate) === label;
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      if (label === 'Today') onDateChange(new Date());
                      else {
                        const y = new Date();
                        y.setDate(y.getDate() - 1);
                        onDateChange(y);
                      }
                      setOpen(false);
                    }}
                    className={`p-4 rounded-xl border text-center transition-all ${
                      isActive ? 'border-[rgba(77,184,220,0.5)] bg-[rgba(77,184,220,0.1)] text-accent' : 'border-[var(--color-border-soft)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)]'
                    }`}
                  >
                    <div className="font-semibold">{label}</div>
                  </button>
                );
              })}
            </div>
            <input
              type="date"
              value={formatDateForInput(selectedDate)}
              onChange={(e) => onDateChange(parseLocalDateKey(e.target.value))}
              className="input-premium mb-4"
            />
            <button type="button" onClick={() => setOpen(false)} className="btn-primary">Done</button>
          </div>
        </div>
      )}
    </>
  );
};

export default LogDatePicker;
