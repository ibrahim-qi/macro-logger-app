import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import type { Session } from '@supabase/supabase-js';

interface GoalsFormData {
  daily_calories_goal: string;
  daily_protein_goal: string;
  daily_carbs_goal: string;
  daily_fats_goal: string;
}

interface GoalsSettingsFormProps {
  session: Session;
  isOpen: boolean;
  onClose: () => void;
  onGoalsUpdated?: () => void; // Callback when goals are successfully updated
}

const GoalsSettingsForm: React.FC<GoalsSettingsFormProps> = ({ 
  session, 
  isOpen, 
  onClose, 
  onGoalsUpdated 
}) => {
  const [formData, setFormData] = useState<GoalsFormData>({
    daily_calories_goal: '2000',
    daily_protein_goal: '150',
    daily_carbs_goal: '250',
    daily_fats_goal: '65'
  });
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Fetch current goals when modal opens
  useEffect(() => {
    if (isOpen && session) {
      fetchCurrentGoals();
    }
  }, [isOpen, session]);

  const fetchCurrentGoals = async () => {
    try {
      setLoading(true);
      setMessage(null);

      const { data, error } = await supabase
        .from('user_goals')
        .select('daily_calories_goal, daily_protein_goal, daily_carbs_goal, daily_fats_goal')
        .eq('user_id', session.user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No goals found - use defaults
          console.log('No existing goals found, using defaults');
        } else {
          throw error;
        }
      } else {
        // Load existing goals
        setFormData({
          daily_calories_goal: data.daily_calories_goal.toString(),
          daily_protein_goal: data.daily_protein_goal.toString(),
          daily_carbs_goal: data.daily_carbs_goal.toString(),
          daily_fats_goal: data.daily_fats_goal.toString()
        });
      }
    } catch (err: any) {
      console.error('Error fetching goals:', err);
      setMessage('Failed to load current goals');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setSaving(true);
      setMessage(null);

      // Validate inputs
      const calories = parseFloat(formData.daily_calories_goal);
      const protein = parseFloat(formData.daily_protein_goal);
      const carbs = parseFloat(formData.daily_carbs_goal);
      const fats = parseFloat(formData.daily_fats_goal);

      if (calories < 500 || calories > 10000) {
        throw new Error('Calories must be between 500 and 10,000');
      }
      if (protein < 0 || protein > 500) {
        throw new Error('Protein must be between 0 and 500g');
      }
      if (carbs < 0 || carbs > 1000) {
        throw new Error('Carbs must be between 0 and 1,000g');
      }
      if (fats < 0 || fats > 300) {
        throw new Error('Fats must be between 0 and 300g');
      }

      // Upsert goals (insert or update)
      const { error } = await supabase
        .from('user_goals')
        .upsert({
          user_id: session.user.id,
          daily_calories_goal: calories,
          daily_protein_goal: protein,
          daily_carbs_goal: carbs,
          daily_fats_goal: fats
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      setMessage('Goals updated successfully!');
      
      // Call callback to refresh parent component
      if (onGoalsUpdated) {
        onGoalsUpdated();
      }

      // Close modal after short delay
      setTimeout(() => {
        onClose();
        setMessage(null);
      }, 1500);

    } catch (err: any) {
      console.error('Error saving goals:', err);
      setMessage(err.message || 'Failed to save goals');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-xl w-full max-w-md shadow-2xl transform transition-transform">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-stone-200">
          <h3 className="text-lg font-semibold text-stone-900">Daily Macro Goals</h3>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-stone-100 transition-colors focus:outline-none focus:ring-2 focus:ring-stone-300"
          >
            <svg className="w-5 h-5 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-slate-700"></div>
              <p className="text-sm text-stone-500 mt-2">Loading current goals...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Calories Goal */}
              <div>
                <label htmlFor="daily_calories_goal" className="block text-sm font-medium text-stone-900 mb-2">
                  Daily Calories Goal
                </label>
                <input
                  type="number"
                  id="daily_calories_goal"
                  name="daily_calories_goal"
                  value={formData.daily_calories_goal}
                  onChange={handleInputChange}
                  required
                  min="500"
                  max="10000"
                  step="50"
                  placeholder="2000"
                  className="w-full px-0 py-3 text-base bg-transparent border-0 border-b border-stone-200 focus:outline-none focus:border-slate-700 focus:ring-0 placeholder-stone-400 transition-colors"
                />
                <p className="text-xs text-stone-500 mt-1">Recommended: 1800-2500 calories</p>
              </div>

              {/* Macros Goals */}
              <div>
                <h4 className="text-sm font-medium text-stone-900 mb-4">Macronutrient Goals</h4>
                
                <div className="grid grid-cols-3 gap-4">
                  {/* Protein */}
                  <div>
                    <label htmlFor="daily_protein_goal" className="block text-xs text-stone-600 mb-2">
                      Protein (g)
                    </label>
                    <input
                      type="number"
                      id="daily_protein_goal"
                      name="daily_protein_goal"
                      value={formData.daily_protein_goal}
                      onChange={handleInputChange}
                      required
                      min="0"
                      max="500"
                      step="5"
                      placeholder="150"
                      className="w-full px-0 py-2 text-sm bg-transparent border-0 border-b border-stone-200 focus:outline-none focus:border-slate-700 focus:ring-0 placeholder-stone-400 transition-colors"
                    />
                  </div>

                  {/* Carbs */}
                  <div>
                    <label htmlFor="daily_carbs_goal" className="block text-xs text-stone-600 mb-2">
                      Carbs (g)
                    </label>
                    <input
                      type="number"
                      id="daily_carbs_goal"
                      name="daily_carbs_goal"
                      value={formData.daily_carbs_goal}
                      onChange={handleInputChange}
                      required
                      min="0"
                      max="1000"
                      step="10"
                      placeholder="250"
                      className="w-full px-0 py-2 text-sm bg-transparent border-0 border-b border-stone-200 focus:outline-none focus:border-slate-700 focus:ring-0 placeholder-stone-400 transition-colors"
                    />
                  </div>

                  {/* Fats */}
                  <div>
                    <label htmlFor="daily_fats_goal" className="block text-xs text-stone-600 mb-2">
                      Fats (g)
                    </label>
                    <input
                      type="number"
                      id="daily_fats_goal"
                      name="daily_fats_goal"
                      value={formData.daily_fats_goal}
                      onChange={handleInputChange}
                      required
                      min="0"
                      max="300"
                      step="5"
                      placeholder="65"
                      className="w-full px-0 py-2 text-sm bg-transparent border-0 border-b border-stone-200 focus:outline-none focus:border-slate-700 focus:ring-0 placeholder-stone-400 transition-colors"
                    />
                  </div>
                </div>

                <p className="text-xs text-stone-500 mt-3">
                  Typical ratios: 25% protein, 45% carbs, 30% fats
                </p>
              </div>

              {/* Message */}
              {message && (
                <div className={`p-3 rounded-xl border text-sm font-medium text-center ${
                  message.includes('success') 
                    ? 'text-green-800 bg-green-50 border-green-200' 
                    : 'text-red-800 bg-red-50 border-red-200'
                }`}>
                  {message}
                </div>
              )}

              {/* Submit Button */}
              <div className="pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full py-4 bg-slate-700 hover:bg-slate-800 disabled:bg-stone-300 text-white font-medium text-base rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-700 focus:ring-offset-2 transition-colors shadow-sm"
                >
                  {saving ? 'Saving Goals...' : 'Update Goals'}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default GoalsSettingsForm;
