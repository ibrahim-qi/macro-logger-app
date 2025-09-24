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
    } catch (error: any) {
      console.error('Error inserting data:', error);
      setMessage(`Error adding entry: ${error.message}`);
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 sm:p-6 border border-gray-200/80 rounded-xl shadow-md bg-white space-y-4 sm:space-y-5">
      <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-3 sm:mb-4 text-center">Add Food Entry</h2>
      
      <div>
        <label htmlFor="food_name" className="block text-sm font-medium text-gray-700 mb-0.5">Food Name</label>
        <input
          type="text"
          id="food_name"
          name="food_name"
          value={formData.food_name}
          onChange={handleChange}
          required
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div>
          <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-0.5">Quantity</label>
          <input
            type="number"
            id="quantity"
            name="quantity"
            value={formData.quantity}
            onChange={handleChange}
            required
            min="0.01"
            step="0.01"
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors"
          />
        </div>
        <div>
          <label htmlFor="calories" className="block text-sm font-medium text-gray-700 mb-0.5">Calories (per one)</label>
          <input
            type="number"
            id="calories"
            name="calories"
            value={formData.calories}
            onChange={handleChange}
            required
            min="0"
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:gap-4 pt-1">
        <div>
          <label htmlFor="protein" className="block text-sm font-medium text-gray-700 mb-0.5">Protein (g)</label>
          <input
            type="number"
            id="protein"
            name="protein"
            value={formData.protein}
            onChange={handleChange}
            min="0"
            step="0.1"
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors"
          />
        </div>
        <div>
          <label htmlFor="carbs" className="block text-sm font-medium text-gray-700 mb-0.5">Carbs (g)</label>
          <input
            type="number"
            id="carbs"
            name="carbs"
            value={formData.carbs}
            onChange={handleChange}
            min="0"
            step="0.1"
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors"
          />
        </div>
        <div>
          <label htmlFor="fats" className="block text-sm font-medium text-gray-700 mb-0.5">Fats (g)</label>
          <input
            type="number"
            id="fats"
            name="fats"
            value={formData.fats}
            onChange={handleChange}
            min="0"
            step="0.1"
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-base font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-60 transition-colors duration-150"
      >
        {loading ? 'Adding...' : 'Add Entry'}
      </button>

      {message && (
        <p 
          className={`text-sm text-center p-2 rounded-md border ${ 
            message.toLowerCase().startsWith('error') || message.toLowerCase().includes('failed') || message.toLowerCase().includes('please enter')
              ? 'text-red-800 bg-red-100 border-red-300' 
              : 'text-green-800 bg-green-100 border-green-300'}`
          }
        >
          {message}
        </p>
      )}
    </form>
  );
});

export default FoodEntryForm; 