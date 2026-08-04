import React from 'react';
import PageHeader from './PageHeader';
import { getStatsIntro } from '../copy/experience';
import { useUserExperience } from '../context/UserExperienceContext';

interface SummaryDisplayHeaderProps {
  weeklyDaysLogged: number | null | undefined;
}

const SummaryDisplayHeader: React.FC<SummaryDisplayHeaderProps> = ({ weeklyDaysLogged }) => {
  const { experience } = useUserExperience();
  const intro = getStatsIntro({
    ...experience,
    weeklyDaysLogged: weeklyDaysLogged ?? experience.weeklyDaysLogged,
  });

  return (
    <PageHeader
      eyebrow="Nutrition trends"
      title={intro}
      subtitle="A calm view of how you've been eating."
      large
    />
  );
};

export default SummaryDisplayHeader;
