import React, { useState, forwardRef, useImperativeHandle } from 'react';
import { supabase } from '../supabaseClient';
import type { Session } from '@supabase/supabase-js';
import type { SavedFoodItem } from './SavedFoodManager';

interface FoodEntryFormProps {
  session: Session;
}

interface FormData {
  food_name: string;
  calories: number | '';
  protein: number | '';
  carbs: number | '';
  fats: number | '';
  quantity: number;
}

export interface FoodEntryFormHandle {
  setFields: (food: SavedFoodItem) => void;
}

const FoodEntryForm = forwardRef<FoodEntryFormHandle, FoodEntryFormProps>(({ session }, ref) => {
  const [formData, setFormData] = useState<FormData>({
    food_name: '',
    calories: '',
    protein: '',
    carbs: '',
    fats: '',
    quantity: 1,
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Date selection state
  const [selectedDate, setSelectedDate] = useState<Date>(new Date()); // Default to today
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Helper functions for date handling
  const formatDateForDisplay = (date: Date): string => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString();
    }
  };

  const formatDateForInput = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  const createTimestampForDate = (date: Date): string => {
    // Create a timestamp for the selected date at the current time
    const now = new Date();
    const selectedDateTime = new Date(date);
    selectedDateTime.setHours(now.getHours());
    selectedDateTime.setMinutes(now.getMinutes());
    selectedDateTime.setSeconds(now.getSeconds());
    selectedDateTime.setMilliseconds(now.getMilliseconds());
    
    return selectedDateTime.toISOString();
  };

  const setToday = () => {
    setSelectedDate(new Date());
  };

  const setYesterday = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    setSelectedDate(yesterday);
  };

  useImperativeHandle(ref, () => ({
    setFields: (food) => {
      setFormData({
        food_name: food.food_name,
        calories: food.calories,
        protein: food.protein,
        carbs: food.carbs,
        fats: food.fats,
        quantity: 1,
      });
    }
  }));

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: type === 'number' ? (value === '' ? '' : Number(value)) : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (!formData.food_name || formData.calories === '' || isNaN(Number(formData.calories))) {
        setMessage('Please enter a food name and valid calorie amount.');
        setLoading(false);
        return;
    }

    const qty = Number(formData.quantity) || 1;

    const entryData = {
        user_id: session.user.id,
        food_name: formData.food_name,
        calories: Number(formData.calories) || 0,
        protein: Number(formData.protein) || 0,
        carbs: Number(formData.carbs) || 0,
        fats: Number(formData.fats) || 0,
        quantity: qty,
        created_at: createTimestampForDate(selectedDate), // Use selected date instead of database default
    };

    try {
      const { error } = await supabase
        .from('food_entries')
        .insert([entryData]);

      if (error) throw error;

      setMessage('Food entry added successfully!');
      setFormData({
        food_name: '',
        calories: '',
        protein: '',
        carbs: '',
        fats: '',
        quantity: 1,
      });
      // Reset date to today after successful submission
      setSelectedDate(new Date());
      setShowDatePicker(false);
    } catch (error: any) {
      console.error('Error inserting data:', error);
      setMessage(`Error adding entry: ${error.message}`);
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  return (
    <>
      <div>
        {/* Minimal Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-medium text-slate-700">Add Entry</h1>
            <p className="text-sm text-stone-500 mt-1">Log your food</p>
          </div>
          
          {/* Clean Date Badge */}
          <button
            type="button"
            onClick={() => setShowDatePicker(true)}
            className="flex items-center space-x-2 px-3 py-2 bg-stone-100 hover:bg-stone-200 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-stone-300"
          >
            <span className="text-sm text-stone-700">{formatDateForDisplay(selectedDate)}</span>
            <svg className="w-4 h-4 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Basic Info Card */}
            <div className="bg-white rounded-xl shadow-sm border border-stone-100 p-6">
              <div className="space-y-6">
                {/* Food Name */}
                <div>
                  <label htmlFor="food_name" className="block text-sm font-medium text-stone-900 mb-2">
                    Food Name
                  </label>
                  <input
                    type="text"
                    id="food_name"
                    name="food_name"
                    value={formData.food_name}
                    onChange={handleChange}
                    required
                    placeholder="Chicken breast, apple, rice..."
                    className="w-full px-0 py-3 text-lg bg-transparent border-0 border-b border-stone-200 focus:outline-none focus:border-slate-700 focus:ring-0 placeholder-stone-400 transition-colors"
                  />
                </div>

                {/* Quantity and Calories */}
                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <label htmlFor="quantity" className="block text-sm font-medium text-stone-900 mb-2">
                      Quantity
                    </label>
                    <input
                      type="number"
                      id="quantity"
                      name="quantity"
                      value={formData.quantity}
                      onChange={handleChange}
                      required
                      min="0.01"
                      step="0.01"
                      inputMode="decimal"
                      placeholder="1.5"
                      className="w-full px-0 py-3 text-lg bg-transparent border-0 border-b border-stone-200 focus:outline-none focus:border-slate-700 focus:ring-0 placeholder-stone-400 transition-colors"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="calories" className="block text-sm font-medium text-stone-900 mb-2">
                      Calories
                    </label>
                    <input
                      type="number"
                      id="calories"
                      name="calories"
                      value={formData.calories}
                      onChange={handleChange}
                      required
                      min="0"
                      inputMode="numeric"
                      placeholder="200"
                      className="w-full px-0 py-3 text-lg bg-transparent border-0 border-b border-stone-200 focus:outline-none focus:border-slate-700 focus:ring-0 placeholder-stone-400 transition-colors"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Macros Card */}
            <div className="bg-white rounded-xl shadow-sm border border-stone-100 p-6">
              <div className="mb-4">
                <h3 className="text-sm font-medium text-stone-900">Macros</h3>
                <p className="text-xs text-stone-500 mt-1">Optional, per serving</p>
              </div>
              
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <label htmlFor="protein" className="block text-xs text-stone-600 mb-2">
                    Protein (g)
                  </label>
                  <input
                    type="number"
                    id="protein"
                    name="protein"
                    value={formData.protein}
                    onChange={handleChange}
                    min="0"
                    step="0.1"
                    inputMode="decimal"
                    placeholder="25"
                    className="w-full px-0 py-2 text-base bg-transparent border-0 border-b border-stone-200 focus:outline-none focus:border-slate-700 focus:ring-0 placeholder-stone-400 transition-colors"
                  />
                </div>
                
                <div>
                  <label htmlFor="carbs" className="block text-xs text-stone-600 mb-2">
                    Carbs (g)
                  </label>
                  <input
                    type="number"
                    id="carbs"
                    name="carbs"
                    value={formData.carbs}
                    onChange={handleChange}
                    min="0"
                    step="0.1"
                    inputMode="decimal"
                    placeholder="30"
                    className="w-full px-0 py-2 text-base bg-transparent border-0 border-b border-stone-200 focus:outline-none focus:border-slate-700 focus:ring-0 placeholder-stone-400 transition-colors"
                  />
                </div>
                
                <div>
                  <label htmlFor="fats" className="block text-xs text-stone-600 mb-2">
                    Fats (g)
                  </label>
                  <input
                    type="number"
                    id="fats"
                    name="fats"
                    value={formData.fats}
                    onChange={handleChange}
                    min="0"
                    step="0.1"
                    inputMode="decimal"
                    placeholder="15"
                    className="w-full px-0 py-2 text-base bg-transparent border-0 border-b border-stone-200 focus:outline-none focus:border-slate-700 focus:ring-0 placeholder-stone-400 transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-slate-700 hover:bg-slate-800 disabled:bg-stone-300 text-white font-medium text-base rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-700 focus:ring-offset-2 transition-colors shadow-sm"
              >
                {loading ? 'Adding...' : 'Add Entry'}
              </button>
            </div>
          </form>

        {/* Success/Error Message */}
      {message && (
          <div className={`mt-6 p-4 rounded-xl border ${
            message.toLowerCase().startsWith('error') || message.toLowerCase().includes('failed') || message.toLowerCase().includes('please enter')
              ? 'bg-red-50 border-red-200 text-red-800' 
              : 'bg-slate-50 border-slate-200 text-slate-800'
          }`}>
            <p className="text-center text-sm font-medium">{message}</p>
          </div>
        )}
      </div>

    {/* Mobile-First Date Selection Modal */}
    {showDatePicker && (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
        {/* Backdrop */}
        <div 
          className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={() => setShowDatePicker(false)}
        />
        
        {/* Modal Content */}
        <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md mx-4 mb-0 sm:mb-8 shadow-2xl transform transition-transform">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Select Date</h3>
            <button
              type="button"
              onClick={() => setShowDatePicker(false)}
              className="p-2 rounded-full hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
            >
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Date Options */}
          <div className="p-4 space-y-3">
            {/* Quick Date Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => { setToday(); setShowDatePicker(false); }}
                className={`relative p-5 rounded-2xl text-center transition-all duration-200 border-2 ${
                  formatDateForDisplay(selectedDate) === 'Today' 
                    ? 'bg-slate-700 border-slate-700 text-white shadow-xl scale-[1.02]' 
                    : 'bg-white border-stone-200 text-stone-700 hover:border-slate-300 hover:shadow-md active:bg-stone-50'
                }`}
              >
                <div className={`w-8 h-8 mx-auto mb-3 rounded-full flex items-center justify-center ${
                  formatDateForDisplay(selectedDate) === 'Today'
                    ? 'bg-white bg-opacity-20'
                    : 'bg-green-100'
                }`}>
                  <div className={`w-3 h-3 rounded-full ${
                    formatDateForDisplay(selectedDate) === 'Today'
                      ? 'bg-white'
                      : 'bg-green-500'
                  }`}></div>
                </div>
                <div className="font-semibold text-base">Today</div>
                <div className="text-xs opacity-75 mt-1">{new Date().toLocaleDateString()}</div>
              </button>
              
              <button
                type="button"
                onClick={() => { setYesterday(); setShowDatePicker(false); }}
                className={`relative p-5 rounded-2xl text-center transition-all duration-200 border-2 ${
                  formatDateForDisplay(selectedDate) === 'Yesterday' 
                    ? 'bg-slate-700 border-slate-700 text-white shadow-xl scale-[1.02]' 
                    : 'bg-white border-stone-200 text-stone-700 hover:border-slate-300 hover:shadow-md active:bg-stone-50'
                }`}
              >
                <div className={`w-8 h-8 mx-auto mb-3 rounded-full flex items-center justify-center ${
                  formatDateForDisplay(selectedDate) === 'Yesterday'
                    ? 'bg-white bg-opacity-20'
                    : 'bg-amber-100'
                }`}>
                  <div className={`w-3 h-3 rounded-full ${
                    formatDateForDisplay(selectedDate) === 'Yesterday'
                      ? 'bg-white'
                      : 'bg-amber-500'
                  }`}></div>
                </div>
                <div className="font-semibold text-base">Yesterday</div>
                <div className="text-xs opacity-75 mt-1">{(() => {
                  const yesterday = new Date();
                  yesterday.setDate(yesterday.getDate() - 1);
                  return yesterday.toLocaleDateString();
                })()}</div>
              </button>
            </div>

            {/* Custom Date Picker */}
            <div className="pt-4 border-t border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Choose a different date:
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={formatDateForInput(selectedDate)}
                  onChange={(e) => {
                    const newDate = new Date(e.target.value + 'T00:00:00');
                    setSelectedDate(newDate);
                  }}
                  className="w-full p-4 border-2 border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500 text-base bg-white hover:border-slate-300 transition-colors"
                />
                <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3 pt-6">
              <button
                type="button"
                onClick={() => setShowDatePicker(false)}
                className="flex-1 py-3 px-4 border-2 border-gray-200 rounded-xl text-gray-700 font-semibold hover:bg-gray-50 hover:border-gray-300 transition-all focus:outline-none focus:ring-2 focus:ring-gray-400 active:scale-[0.98]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setShowDatePicker(false)}
                className="flex-1 py-3 px-4 bg-slate-700 text-white rounded-xl font-semibold hover:bg-slate-800 transition-all focus:outline-none focus:ring-2 focus:ring-slate-400 shadow-lg hover:shadow-xl active:scale-[0.98]"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
});

export default FoodEntryForm; 