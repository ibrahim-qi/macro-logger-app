import React, { useState } from 'react';
import { formatLocalDateKey, parseLocalDateKey } from '../utils/localDate';
import {
  formatDateChipLabel,
  formatDatePillLabel,
  isSelectedToday,
} from '../utils/dateDisplay';

interface DatePickerProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  /** standalone = pill only (Log). nav = chevrons + pill (Today). */
  layout?: 'standalone' | 'nav';
  onPrevious?: () => void;
  onNext?: () => void;
  disableNext?: boolean;
  onJumpToday?: () => void;
  variant?: 'pill' | 'chip';
  tone?: 'default' | 'quiet';
  className?: string;
}

function DatePickerModal({
  selectedDate,
  onDateChange,
  onClose,
}: {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  onClose: () => void;
}) {
  return (
    <div className="modal-overlay safe-x z-[110]" onClick={onClose}>
      <div className="modal-panel card-elevated p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-header__title mb-4">Choose date</h3>
        <div className="grid grid-cols-2 gap-3 mb-4">
          {(['Today', 'Yesterday'] as const).map((label) => {
            const isActive = formatDateChipLabel(selectedDate) === label;
            return (
              <button
                key={label}
                type="button"
                onClick={() => {
                  if (label === 'Today') onDateChange(new Date());
                  else {
                    const yesterday = new Date();
                    yesterday.setDate(yesterday.getDate() - 1);
                    onDateChange(yesterday);
                  }
                  onClose();
                }}
                className={`p-4 rounded-xl border text-center transition-all ${
                  isActive
                    ? 'border-[rgba(var(--color-accent-rgb),0.5)] bg-[rgba(var(--color-accent-rgb),0.1)] text-accent'
                    : 'border-[var(--color-border-soft)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)]'
                }`}
              >
                <div className="font-semibold">{label}</div>
              </button>
            );
          })}
        </div>
        <input
          type="date"
          value={formatLocalDateKey(selectedDate)}
          onChange={(e) => onDateChange(parseLocalDateKey(e.target.value))}
          className="input-premium mb-4"
        />
        <button type="button" onClick={onClose} className="btn-primary">
          Done
        </button>
      </div>
    </div>
  );
}

function DatePickerPill({
  selectedDate,
  onOpen,
  tone = 'default',
  className = '',
}: {
  selectedDate: Date;
  onOpen: () => void;
  tone?: 'default' | 'quiet';
  className?: string;
}) {
  const viewingToday = isSelectedToday(selectedDate);
  const label = formatDatePillLabel(selectedDate);

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`date-pill ${viewingToday ? 'date-pill--today' : ''} ${tone === 'quiet' ? 'date-pill--quiet' : ''} ${className}`.trim()}
      aria-label={`Viewing ${label}. Change date.`}
    >
      <svg className="date-pill__icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.75}
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
      <span>{label}</span>
      <svg className="date-pill__chevron" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  );
}

const DatePicker: React.FC<DatePickerProps> = ({
  selectedDate,
  onDateChange,
  layout = 'standalone',
  onPrevious,
  onNext,
  disableNext = false,
  onJumpToday,
  variant = 'pill',
  tone = 'default',
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  const viewingToday = isSelectedToday(selectedDate);

  if (layout === 'nav') {
    return (
      <>
        <nav className="date-nav" aria-label="Choose day">
          <button
            type="button"
            onClick={onPrevious}
            className="date-nav__chev"
            aria-label="Previous day"
          >
            <svg className="date-nav__chev-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="date-nav__center">
            <DatePickerPill selectedDate={selectedDate} onOpen={() => setOpen(true)} />
            {!viewingToday && onJumpToday && (
              <button type="button" onClick={onJumpToday} className="date-nav__jump">
                Jump to today
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onNext}
            disabled={disableNext}
            className="date-nav__chev"
            aria-label="Next day"
          >
            <svg className="date-nav__chev-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </nav>

        {open && (
          <DatePickerModal
            selectedDate={selectedDate}
            onDateChange={onDateChange}
            onClose={() => setOpen(false)}
          />
        )}
      </>
    );
  }

  const chipLabel = formatDateChipLabel(selectedDate);
  const triggerClass = variant === 'pill'
    ? `date-pill ${viewingToday ? 'date-pill--today' : ''} ${className}`.trim()
    : `date-chip ${viewingToday ? 'date-chip--today' : ''} ${className}`.trim();

  return (
    <>
      {variant === 'pill' ? (
        <DatePickerPill selectedDate={selectedDate} onOpen={() => setOpen(true)} tone={tone} className={className} />
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={triggerClass}
          aria-label={`Viewing ${chipLabel}. Change date.`}
        >
          {chipLabel}
        </button>
      )}

      {open && (
        <DatePickerModal
          selectedDate={selectedDate}
          onDateChange={onDateChange}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
};

export default DatePicker;
