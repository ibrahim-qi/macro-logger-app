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
    <div className="p-4 sm:p-6 border border-gray-200/80 rounded-xl shadow-md bg-white">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-800">Saved Foods</h2>
            <button 
                onClick={() => {
                    if (showForm && editingFoodId) resetForm(); // If editing, cancel resets form
                    else if (showForm) setShowForm(false); // If adding, just hide
                    else { // If not showing, prepare for adding
                        resetForm(); // Clear any previous edit state
                        setShowForm(true);
                    }
                }}
                className={`flex items-center justify-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors duration-150 ${
                    showForm ? 'bg-red-500 hover:bg-red-600 focus:ring-red-400' : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
                }`}
            >
                <span className="material-icons-outlined text-base sm:text-lg">
                    {showForm ? 'cancel' : 'add_circle_outline'}
                </span>
                <span>
                    {showForm ? (editingFoodId ? 'Cancel Edit' : 'Cancel Add') : 'Add New Saved Food'}
                </span>
            </button>
        </div>

        {showForm && (
            <form onSubmit={handleFormSubmit} className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50/50 space-y-4">
                <h3 className="text-base font-medium text-gray-700">
                    {editingFoodId ? 'Edit Saved Food' : 'Save a New Food'}
                </h3>
                <div>
                    <label htmlFor="saved_food_name" className="block text-sm font-medium text-gray-700 mb-1">Food Name</label>
                    <input type="text" name="food_name" id="saved_food_name" value={formData.food_name} onChange={handleInputChange} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
                </div>
                <div>
                    <label htmlFor="saved_calories" className="block text-sm font-medium text-gray-700 mb-1">Calories (per serving)</label>
                    <input type="number" name="calories" id="saved_calories" value={formData.calories} onChange={handleInputChange} required min="0" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                        <label htmlFor="saved_protein" className="block text-sm font-medium text-gray-700 mb-1">Protein (g)</label>
                        <input type="number" name="protein" id="saved_protein" value={formData.protein} onChange={handleInputChange} min="0" step="0.1" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
                    </div>
                    <div>
                        <label htmlFor="saved_carbs" className="block text-sm font-medium text-gray-700 mb-1">Carbs (g)</label>
                        <input type="number" name="carbs" id="saved_carbs" value={formData.carbs} onChange={handleInputChange} min="0" step="0.1" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
                    </div>
                    <div>
                        <label htmlFor="saved_fats" className="block text-sm font-medium text-gray-700 mb-1">Fats (g)</label>
                        <input type="number" name="fats" id="saved_fats" value={formData.fats} onChange={handleInputChange} min="0" step="0.1" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
                    </div>
                </div>
                <button type="submit" disabled={saving} className="w-full py-2 px-4 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 transition-colors">
                    {saving ? (editingFoodId ? 'Updating...' : 'Saving...') : (editingFoodId ? 'Update Food' : 'Save Food')}
                </button>
                {formMessage && (
                  <p 
                    className={`text-sm text-center mt-2 p-2 rounded-md border ${formMessage.includes('success') 
                      ? 'text-green-800 bg-green-100 border-green-300' 
                      : 'text-red-800 bg-red-100 border-red-300'}`}
                  >
                    {formMessage}
                  </p>
                )}
            </form>
        )}

        {/* Search Input - Added below the form, visible when list is shown */}
        {!showForm && savedFoods.length > 0 && (
            <div className="mb-4">
                <input
                    type="text"
                    placeholder="Search saved foods..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
            </div>
        )}

        {loading && savedFoods.length === 0 && <p className="text-center text-gray-500 py-6">Loading saved foods...</p>}
        {!loading && savedFoods.length === 0 && !showForm && (
          <div className="text-center text-gray-500 py-6 px-4 border border-dashed border-gray-300 rounded-lg">
             <span className="material-icons-outlined text-4xl text-gray-400 mb-2">fastfood</span>
             <p className="font-medium mb-1">No Saved Foods Yet</p>
             <p className="text-sm">Click 'Add New Saved Food' above to create your first reusable food item.</p>
          </div>
        )}
        
        {/* Display filtered list or message if no results from filter */}
        {!loading && filteredFoods.length > 0 && (
            <div className="max-h-80 overflow-y-auto space-y-3 pr-1">
                {filteredFoods.map(food => (
                    <div 
                      key={food.id} 
                      className="flex items-center justify-between gap-3 p-3 border border-gray-200/70 rounded-lg bg-white shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-150"
                    >
                        <div className="overflow-hidden mr-2 flex-grow">
                            <p className="font-medium text-gray-900 truncate capitalize">{food.food_name}</p>
                            <p className="text-xs text-gray-500 mt-0.5">
                                <span className="font-semibold text-blue-600">{food.calories}</span>kcal | 
                                P:<span className="font-medium text-gray-600">{food.protein}g</span> | 
                                C:<span className="font-medium text-gray-600">{food.carbs}g</span> | 
                                F:<span className="font-medium text-gray-600">{food.fats}g</span>
                            </p>
                        </div>
                        
                        <div className="flex items-center shrink-0 space-x-1 sm:space-x-1.5">
                          <button 
                              onClick={() => onFoodSelect(food)}
                              disabled={saving}
                              className="px-2 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:opacity-60 shrink-0 transition-colors"
                              aria-label={`Add ${food.food_name} to journal`}
                          >
                              Add
                          </button>
                          <button
                            onClick={() => handleEditFood(food)}
                            disabled={saving}
                            className="p-1.5 rounded-md text-blue-600 hover:text-blue-800 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1 disabled:opacity-50 shrink-0 transition-colors"
                            aria-label={`Edit saved food ${food.food_name}`}
                          >
                            <span className="material-icons-outlined text-lg leading-none">edit</span>
                          </button>
                          <button 
                              onClick={() => requestDeleteSavedFood(food.id, food.food_name)}
                              disabled={saving}
                              className="p-1.5 rounded-md text-red-500 hover:text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-1 disabled:opacity-50 shrink-0 transition-colors"
                              aria-label={`Delete saved food ${food.food_name}`}
                          >
                              <span className="material-icons-outlined text-lg leading-none">delete</span>
                          </button>
                        </div>
                    </div>
                ))}
            </div>
        )}
        {/* Message when search yields no results but there are saved foods */}
        {!loading && savedFoods.length > 0 && filteredFoods.length === 0 && !showForm && (
            <div className="text-center text-gray-500 py-6 px-4">
                <span className="material-icons-outlined text-4xl text-gray-400 mb-2">search_off</span>
                <p className="font-medium">No Saved Foods Match Your Search</p>
                <p className="text-sm">Try a different search term or clear the search.</p>
            </div>
        )}

      {/* Delete Confirmation Modal */}
      {isDeleteConfirmOpen && itemToDelete && (
        <Modal isOpen={true} onClose={cancelDelete} title="Confirm Deletion">
          <div className="space-y-4">
            <p className="text-gray-700">
              Are you sure you want to delete the saved food <span className="font-semibold">"{itemToDelete.name}"</span>?
            </p>
            <p className="text-sm text-gray-500">This action cannot be undone.</p>
            <div className="flex justify-end space-x-3 pt-2">
                <button
                  onClick={cancelDelete}
                  disabled={saving} // Disable if already processing another save/delete
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteSavedFood}
                  disabled={saving} // Disable if already processing another save/delete
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
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