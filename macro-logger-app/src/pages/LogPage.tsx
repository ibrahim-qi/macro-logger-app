import React, { useRef } from 'react';
import type { Session } from '@supabase/supabase-js';
import FoodEntryForm from '../components/FoodEntryForm';
import type { FoodEntryFormHandle } from '../components/FoodEntryForm';
import SavedFoodManager from '../components/SavedFoodManager';
import type { SavedFoodItem } from '../components/SavedFoodManager';

interface LogPageProps {
  session: Session;
}

const LogPage: React.FC<LogPageProps> = ({ session }) => {
  const foodEntryFormRef = useRef<FoodEntryFormHandle>(null);
  const formSectionRef = useRef<HTMLElement>(null);

  const handleSavedFoodSelect = (food: SavedFoodItem) => {
    foodEntryFormRef.current?.setFields(food);
    formSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Saved Foods Section */}
      <section aria-labelledby="saved-foods-heading">
        <h2 id="saved-foods-heading" className="sr-only">Saved Foods</h2>
        <SavedFoodManager session={session} onFoodSelect={handleSavedFoodSelect} />
      </section>

      {/* Food Entry Form Section */}
      <section ref={formSectionRef} aria-labelledby="add-food-entry-heading">
        <h2 id="add-food-entry-heading" className="sr-only">Add Food Entry</h2>
        <FoodEntryForm ref={foodEntryFormRef} session={session} />
      </section>
    </div>
  );
};

export default LogPage; 