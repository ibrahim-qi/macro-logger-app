import React from 'react';
import DatePicker from './DatePicker';
import { getLogTitle } from '../copy/experience';
import { useUserExperience } from '../context/userExperience';

interface LogHeroProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
}

const LogHero: React.FC<LogHeroProps> = ({ selectedDate, onDateChange }) => {
  const { experience } = useUserExperience();

  return (
    <header className="log-hero">
      <div className="log-hero__date">
        <DatePicker
          selectedDate={selectedDate}
          onDateChange={onDateChange}
          layout="standalone"
          variant="pill"
          tone="quiet"
        />
      </div>

      <h1 className="log-hero__prompt">{getLogTitle(experience)}</h1>
    </header>
  );
};

export default LogHero;
