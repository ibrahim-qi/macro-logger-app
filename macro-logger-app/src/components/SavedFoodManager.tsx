import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import type { Session } from '@supabase/supabase-js';
import Modal from './Modal'; // Import Modal component

// Interface for the data of a single saved food item
export interface SavedFoodItem {
  id: number;
  food_name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  // user_id and created_at are also there but not always needed for display
}

// Interface for the form to add/edit a new saved food
interface SavedFoodFormData {
  food_name: string;
  calories: number | '';
  protein: number | '';
  carbs: number | '';
  fats: number | '';
}

interface SavedFoodManagerProps {
  session: Session;
  onFoodSelect: (food: SavedFoodItem) => void; // Callback when a food is selected to be added to journal
}

const SavedFoodManager: React.FC<SavedFoodManagerProps> = ({ session, onFoodSelect }) => {
  const [savedFoods, setSavedFoods] = useState<SavedFoodItem[]>([]);
  const [formData, setFormData] = useState<SavedFoodFormData>({
    food_name: '',
    calories: '',
    protein: '',
    carbs: '',
    fats: '',
  });
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false); // For general loading like initial fetch
  const [saving, setSaving] = useState(false); // For save/update operation
  const [error, setError] = useState<string | null>(null);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [editingFoodId, setEditingFoodId] = useState<number | null>(null); // To track if editing
  const [searchTerm, setSearchTerm] = useState(''); // State for search/filter

  // State for Delete Confirmation Modal
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{id: number; name: string} | null>(null);

  // Fetch saved foods
  const fetchSavedFoods = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('saved_foods')
        .select('id, food_name, calories, protein, carbs, fats')
        .eq('user_id', session.user.id)
        .order('food_name', { ascending: true });

      if (error) throw error;
      setSavedFoods(data || []);
    } catch (err: any) {
      console.error('Error fetching saved foods:', err);
      setError('Could not load your saved foods.');
    } finally {
      setLoading(false);
    }
  }, [session.user.id]);

  useEffect(() => {
    fetchSavedFoods();
  }, [fetchSavedFoods]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({ 
        ...prev, 
        [name]: type === 'number' ? (value === '' ? '' : Number(value)) : value 
    }));
  };

  const resetForm = () => {
    setFormData({ food_name: '', calories: '', protein: '', carbs: '', fats: '' });
    setEditingFoodId(null);
    setShowForm(false);
    setFormMessage(null);
  };
  
  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!formData.food_name || formData.calories === '' || isNaN(Number(formData.calories))) {
        setFormMessage('Food name and valid calories are required.');
        return;
    }
    setSaving(true);
    setFormMessage(null);

    const foodDataToSave = {
        // user_id is handled by RLS policy, not needed for update if policy allows
        food_name: formData.food_name,
        calories: Number(formData.calories),
        protein: Number(formData.protein) || 0,
        carbs: Number(formData.carbs) || 0,
        fats: Number(formData.fats) || 0,
    };

    try {
      let savedItem: SavedFoodItem;
      if (editingFoodId) {
        // Update existing food
        const { data, error: updateError } = await supabase
          .from('saved_foods')
          .update(foodDataToSave)
          .match({ id: editingFoodId, user_id: session.user.id }) // Ensure user owns it
          .select()
          .single();
        if (updateError) {
            if (updateError.code === '23505') { // Unique constraint violation on name
                throw new Error(`Another food is already named "${formData.food_name}".`);
            }
            throw updateError;
        }
        savedItem = data as SavedFoodItem;
        setSavedFoods(prev => prev.map(food => food.id === editingFoodId ? savedItem : food).sort((a,b) => a.food_name.localeCompare(b.food_name)));
        setFormMessage('Food updated successfully!');
      } else {
        // Insert new food
        const { data, error: insertError } = await supabase
          .from('saved_foods')
          .insert({ ...foodDataToSave, user_id: session.user.id })
          .select()
          .single();
        if (insertError) {
            if (insertError.code === '23505') { // Unique constraint violation on name
                throw new Error(`You already have a food named "${formData.food_name}".`);
            }
            throw insertError;
        }
        savedItem = data as SavedFoodItem;
        setSavedFoods(prev => [...prev, savedItem].sort((a, b) => a.food_name.localeCompare(b.food_name)));
        setFormMessage('Food saved successfully!');
      }
      resetForm();
      setTimeout(() => setFormMessage(null), 3000);
    } catch (err: any) {
      console.error('Error saving/updating food:', err);
      setFormMessage(err.message || 'Could not save/update food.');
    } finally {
      setSaving(false);
    }
  };

  const handleEditFood = (food: SavedFoodItem) => {
    setEditingFoodId(food.id);
    setFormData({
      food_name: food.food_name,
      calories: food.calories,
      protein: food.protein,
      carbs: food.carbs,
      fats: food.fats,
    });
    setShowForm(true);
    setFormMessage(null);
  };

  // Function to handle deleting a saved food item
  // Step 1: Open the confirmation modal
  const requestDeleteSavedFood = (foodId: number, foodName: string) => {
    setItemToDelete({ id: foodId, name: foodName });
    setIsDeleteConfirmOpen(true);
    setFormMessage(null); // Clear previous messages
  };

  // Step 2: Close the confirmation modal
  const cancelDelete = () => {
    setIsDeleteConfirmOpen(false);
    setItemToDelete(null);
  };

  // Step 3: Execute the deletion if confirmed
  const confirmDeleteSavedFood = async () => {
    if (!itemToDelete) return;

    const { id: foodId, name: foodName } = itemToDelete;
    cancelDelete(); // Close modal first
    setSaving(true); 

    try {
      const { error: deleteError } = await supabase
        .from('saved_foods')
        .delete()
        .match({ id: foodId });

      if (deleteError) throw deleteError;

      // Remove from local state
      setSavedFoods(currentFoods => currentFoods.filter(food => food.id !== foodId));
      setFormMessage(`"${foodName}" deleted successfully!`);
      setTimeout(() => setFormMessage(null), 3000);

    } catch (err: any) {
      console.error('Error deleting saved food:', err);
      setFormMessage(err.message || 'Could not delete saved food.');
    } finally {
      setSaving(false);
    }
  };

  if (error) {
    return <p className="text-red-500 text-center py-3">{error}</p>;
  }

  const filteredFoods = savedFoods.filter(food => 
    food.food_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
        <div className="flex justify-between items-center mb-6">
            <div>
                <h2 className="text-xl font-medium text-slate-700">Saved Foods</h2>
                <p className="text-sm text-stone-500 mt-1">Quick add from your favorites</p>
            </div>
            <button 
                onClick={() => {
                    if (showForm && editingFoodId) resetForm();
                    else if (showForm) setShowForm(false);
                    else { 
                        resetForm();
                        setShowForm(true);
                    }
                }}
                className={`flex items-center space-x-2 px-3 py-2 rounded-full transition-colors focus:outline-none focus:ring-2 ${
                    showForm ? 'bg-stone-100 hover:bg-stone-200 focus:ring-stone-300 text-stone-700' : 'bg-stone-100 hover:bg-stone-200 focus:ring-stone-300 text-stone-700'
                }`}
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {showForm ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    )}
                </svg>
                <span className="text-sm font-medium">
                    {showForm ? 'Cancel' : 'Add'}
                </span>
            </button>
        </div>

        {showForm && (
            <div className="mb-6">
                <div className="bg-white rounded-xl shadow-sm border border-stone-100 p-6">
                    <form onSubmit={handleFormSubmit} className="space-y-6">
                        <div>
                            <h3 className="text-base font-medium text-stone-900 mb-4">
                                {editingFoodId ? 'Edit Food' : 'Save New Food'}
                            </h3>
                        </div>
                        
                        <div>
                            <label htmlFor="saved_food_name" className="block text-sm font-medium text-stone-900 mb-2">Food Name</label>
                            <input 
                                type="text" 
                                name="food_name" 
                                id="saved_food_name" 
                                value={formData.food_name} 
                                onChange={handleInputChange} 
                                required 
                                placeholder="e.g., Grilled Chicken Breast"
                                className="w-full px-0 py-3 text-base bg-transparent border-0 border-b border-stone-200 focus:outline-none focus:border-slate-700 focus:ring-0 placeholder-stone-400 transition-colors"
                            />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-8">
                            <div>
                                <label htmlFor="saved_calories" className="block text-sm font-medium text-stone-900 mb-2">Calories</label>
                                <input 
                                    type="number" 
                                    name="calories" 
                                    id="saved_calories" 
                                    value={formData.calories} 
                                    onChange={handleInputChange} 
                                    required 
                                    min="0" 
                                    inputMode="numeric"
                                    placeholder="200"
                                    className="w-full px-0 py-3 text-base bg-transparent border-0 border-b border-stone-200 focus:outline-none focus:border-slate-700 focus:ring-0 placeholder-stone-400 transition-colors"
                                />
                            </div>
                        </div>
                        
                        <div className="pt-4 mt-4 border-t border-stone-100">
                            <div className="mb-4">
                                <h4 className="text-sm font-medium text-stone-900">Macros (optional)</h4>
                                <p className="text-xs text-stone-500 mt-1">Per serving</p>
                            </div>
                            
                            <div className="grid grid-cols-3 gap-6">
                                <div>
                                    <label htmlFor="saved_protein" className="block text-xs text-stone-600 mb-2">Protein (g)</label>
                                    <input 
                                        type="number" 
                                        name="protein" 
                                        id="saved_protein" 
                                        value={formData.protein} 
                                        onChange={handleInputChange} 
                                        min="0" 
                                        step="0.1" 
                                        inputMode="decimal"
                                        placeholder="25"
                                        className="w-full px-0 py-2 text-sm bg-transparent border-0 border-b border-stone-200 focus:outline-none focus:border-slate-700 focus:ring-0 placeholder-stone-400 transition-colors"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="saved_carbs" className="block text-xs text-stone-600 mb-2">Carbs (g)</label>
                                    <input 
                                        type="number" 
                                        name="carbs" 
                                        id="saved_carbs" 
                                        value={formData.carbs} 
                                        onChange={handleInputChange} 
                                        min="0" 
                                        step="0.1" 
                                        inputMode="decimal"
                                        placeholder="30"
                                        className="w-full px-0 py-2 text-sm bg-transparent border-0 border-b border-stone-200 focus:outline-none focus:border-slate-700 focus:ring-0 placeholder-stone-400 transition-colors"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="saved_fats" className="block text-xs text-stone-600 mb-2">Fats (g)</label>
                                    <input 
                                        type="number" 
                                        name="fats" 
                                        id="saved_fats" 
                                        value={formData.fats} 
                                        onChange={handleInputChange} 
                                        min="0" 
                                        step="0.1" 
                                        inputMode="decimal"
                                        placeholder="15"
                                        className="w-full px-0 py-2 text-sm bg-transparent border-0 border-b border-stone-200 focus:outline-none focus:border-slate-700 focus:ring-0 placeholder-stone-400 transition-colors"
                                    />
                                </div>
                            </div>
                        </div>
                        
                        <div className="pt-6">
                            <button 
                                type="submit" 
                                disabled={saving} 
                                className="w-full py-4 bg-slate-700 hover:bg-slate-800 disabled:bg-stone-300 text-white font-medium text-base rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-700 focus:ring-offset-2 transition-colors shadow-sm"
                            >
                                {saving ? 'Saving...' : (editingFoodId ? 'Update Food' : 'Save Food')}
                            </button>
                        </div>
                        
                        {formMessage && (
                          <div className={`p-3 rounded-xl border text-sm font-medium text-center ${formMessage.includes('success') 
                            ? 'text-green-800 bg-green-50 border-green-200' 
                            : 'text-red-800 bg-red-50 border-red-200'}`}
                          >
                            {formMessage}
                          </div>
                        )}
                    </form>
                </div>
            </div>
        )}

        {/* Search & Food List Container */}
        {!showForm && savedFoods.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-stone-100 overflow-hidden">
                {/* Search Input */}
                <div className="p-4 border-b border-stone-100">
                    <input
                        type="text"
                        placeholder="Search foods..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full px-0 py-3 text-base bg-transparent border-0 border-b border-stone-200 focus:outline-none focus:border-slate-700 focus:ring-0 placeholder-stone-400 transition-colors"
                    />
                </div>
                
                {/* Food List */}
                {filteredFoods.length > 0 && (
                    <div className="divide-y divide-stone-50 max-h-80 overflow-y-auto">
                        {filteredFoods.map(food => (
                            <div 
                              key={food.id} 
                              className="flex items-center justify-between p-4"
                            >
                                <div className="flex-1 mr-4">
                                    <p className="font-medium text-stone-900 capitalize">{food.food_name}</p>
                                    <div className="flex items-center space-x-4 mt-1 text-sm text-stone-500">
                                        <span>{food.calories} cal</span>
                                        {food.protein > 0 && <span>{food.protein}g protein</span>}
                                        {food.carbs > 0 && <span>{food.carbs}g carbs</span>}
                                        {food.fats > 0 && <span>{food.fats}g fats</span>}
                                    </div>
                                </div>
                                
                                <div className="flex space-x-2">
                                  <button 
                                      onClick={() => onFoodSelect(food)}
                                      disabled={saving}
                                      className="px-3 py-2 text-sm font-medium text-white bg-slate-600 hover:bg-slate-700 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:opacity-50"
                                      aria-label={`Add ${food.food_name} to journal`}
                                  >
                                      Use
                                  </button>
                                  
                                  <button
                                    onClick={() => handleEditFood(food)}
                                    disabled={saving}
                                    className="p-2 text-stone-400 hover:text-slate-700 transition-colors disabled:opacity-50"
                                    aria-label={`Edit ${food.food_name}`}
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </button>
                                  
                                  <button 
                                      onClick={() => requestDeleteSavedFood(food.id, food.food_name)}
                                      disabled={saving}
                                      className="p-2 text-stone-400 hover:text-red-500 transition-colors disabled:opacity-50"
                                      aria-label={`Delete ${food.food_name}`}
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )}

        {/* Loading State */}
        {loading && savedFoods.length === 0 && (
            <div className="text-center py-8">
                <p className="text-sm text-stone-500">Loading...</p>
            </div>
        )}
        
        {/* Empty State */}
        {!loading && savedFoods.length === 0 && !showForm && (
          <div className="text-center py-12">
            <div className="text-stone-400 mb-4">
                <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
            </div>
            <p className="text-sm text-stone-500 mb-2">No saved foods yet</p>
            <p className="text-xs text-stone-400">Add foods you eat regularly for quick logging</p>
          </div>
        )}
        
        {/* No Search Results */}
        {!loading && savedFoods.length > 0 && filteredFoods.length === 0 && !showForm && (
            <div className="text-center py-8">
                <div className="text-stone-400 mb-4">
                    <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </div>
                <p className="text-sm text-stone-500">No foods match your search</p>
            </div>
        )}

      {/* Delete Confirmation Modal */}
      {isDeleteConfirmOpen && itemToDelete && (
        <Modal isOpen={true} onClose={cancelDelete} title="Delete Food">
          <div className="space-y-6">
            <p className="text-stone-600">
              Are you sure you want to delete <span className="font-semibold">"{itemToDelete.name}"</span>?
            </p>
            <div className="flex space-x-3">
                <button
                  onClick={cancelDelete}
                  disabled={saving}
                  className="flex-1 py-3 px-4 border border-stone-200 text-stone-700 rounded-xl hover:bg-stone-50 transition-colors focus:outline-none focus:ring-2 focus:ring-stone-300 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteSavedFood}
                  disabled={saving}
                  className="flex-1 py-3 px-4 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-400 disabled:opacity-50"
                >
                  {saving ? 'Deleting...' : 'Delete'}
                </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default SavedFoodManager; 