import React from 'react';

interface TodayDateNavProps {
  displayedDate: Date;
  onPrevious: () => void;
  onNext: () => void;
  onJumpToday: () => void;
}

const isToday = (date: Date): boolean => {
  const today = new Date();
  return date.toDateString() === today.toDateString();
};

function formatDateLabel(date: Date, viewingToday: boolean): string {
  const detail = date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  return viewingToday ? `Today · ${detail}` : detail;
}

const TodayDateNav: React.FC<TodayDateNavProps> = ({
  displayedDate,
  onPrevious,
  onNext,
  onJumpToday,
}) => {
  const viewingToday = isToday(displayedDate);

  return (
    <nav className="today-date" aria-label="Choose day">
      <button type="button" onClick={onPrevious} className="today-date__chev" aria-label="Previous day">
        <svg className="today-date__chev-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <div className="today-date__center">
        <p className="today-date__label">{formatDateLabel(displayedDate, viewingToday)}</p>
        {!viewingToday && (
          <button type="button" onClick={onJumpToday} className="today-date__jump">
            Jump to today
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={onNext}
        disabled={viewingToday}
        className="today-date__chev"
        aria-label="Next day"
      >
        <svg className="today-date__chev-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </nav>
  );
};

export default TodayDateNav;
