import React from 'react';
import LogDatePicker from './LogDatePicker';
import { getLogHelper, getLogTitle } from '../copy/experience';
import { useUserExperience } from '../context/UserExperienceContext';

interface LogHeroProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
}

const LogHero: React.FC<LogHeroProps> = ({ selectedDate, onDateChange }) => {
  const { experience } = useUserExperience();

  return (
    <header className="log-hero">
      <div className="log-hero__canopy" aria-hidden="true" />

      <div className="log-hero__date">
        <LogDatePicker
          selectedDate={selectedDate}
          onDateChange={onDateChange}
          variant="pill"
        />
      </div>

      <h1 className="log-hero__prompt">{getLogTitle(experience)}</h1>
      <p className="log-hero__helper">{getLogHelper()}</p>
    </header>
  );
};

export default LogHero;
