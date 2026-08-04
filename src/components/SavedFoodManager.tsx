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
    return <p className="text-danger text-center py-3">{error}</p>;
  }

  const filteredFoods = savedFoods.filter(food => 
    food.food_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="pt-2">
        <div className="flex justify-between items-center mb-4">
            <p className="text-xs text-[var(--color-text-muted)]">{savedFoods.length} saved</p>
            <button
                onClick={() => {
                    if (showForm && editingFoodId) resetForm();
                    else if (showForm) setShowForm(false);
                    else { resetForm(); setShowForm(true); }
                }}
                className="btn-ghost text-xs py-1.5 px-3"
            >
                {showForm ? 'Cancel' : '+ Add food'}
            </button>
        </div>

        {showForm && (
            <div className="mb-4 card p-4">
                    <form onSubmit={handleFormSubmit} className="space-y-4">
                        <p className="text-sm font-semibold text-white">{editingFoodId ? 'Edit food' : 'Save new food'}</p>
                        
                        <div>
                            <label htmlFor="saved_food_name" className="form-label-sm">Food name</label>
                            <input type="text" name="food_name" id="saved_food_name" value={formData.food_name} onChange={handleInputChange} required placeholder="Grilled chicken" className="input-premium" />
                        </div>

                        <div>
                            <label htmlFor="saved_calories" className="form-label text-macro-calories">Calories</label>
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
                                className="input-premium"
                            />
                        </div>

                        <div className="pt-2 border-t border-[var(--color-border)]">
                            <p className="form-label">Macros (optional)</p>
                            <p className="form-hint mb-3">Per serving</p>

                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label htmlFor="saved_protein" className="form-label-sm text-macro-protein">Protein (g)</label>
                                    <input type="number" name="protein" id="saved_protein" value={formData.protein} onChange={handleInputChange} min="0" step="0.1" inputMode="decimal" placeholder="25" className="input-premium" />
                                </div>
                                <div>
                                    <label htmlFor="saved_carbs" className="form-label-sm text-macro-carbs">Carbs (g)</label>
                                    <input type="number" name="carbs" id="saved_carbs" value={formData.carbs} onChange={handleInputChange} min="0" step="0.1" inputMode="decimal" placeholder="30" className="input-premium" />
                                </div>
                                <div>
                                    <label htmlFor="saved_fats" className="form-label-sm text-macro-fats">Fats (g)</label>
                                    <input type="number" name="fats" id="saved_fats" value={formData.fats} onChange={handleInputChange} min="0" step="0.1" inputMode="decimal" placeholder="15" className="input-premium" />
                                </div>
                            </div>
                        </div>
                        
                        <div className="pt-2">
                            <button type="submit" disabled={saving} className="btn-primary">
                                {saving ? 'Saving…' : (editingFoodId ? 'Update' : 'Save')}
                            </button>
                        </div>
                        {formMessage && (
                          <div className={formMessage.includes('success') ? 'alert-success' : 'alert-error'}>
                            {formMessage}
                          </div>
                        )}
                    </form>
            </div>
        )}

        {!showForm && savedFoods.length > 0 && (
            <div>
                <input type="text" placeholder="Search…" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="input-premium mb-3 text-sm" />
                {filteredFoods.length > 0 && (
                    <div className="space-y-2 max-h-64 overflow-y-auto scroll-touch">
                        {filteredFoods.map(food => (
                            <div key={food.id} className="card p-3 flex items-center justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                    <p className="font-medium text-white capitalize truncate text-sm">{food.food_name}</p>
                                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{food.calories} cal · P {food.protein}g</p>
                                </div>
                                <div className="flex gap-1 shrink-0">
                                  <button type="button" onClick={() => onFoodSelect(food)} disabled={saving} className="px-3 py-1.5 text-xs font-semibold text-[var(--color-btn-fill-text)] bg-[var(--color-btn-fill)] rounded-lg hover:opacity-90 disabled:opacity-50">Use</button>
                                  <button type="button" onClick={() => handleEditFood(food)} disabled={saving} className="p-1.5 text-[var(--color-text-muted)] hover:text-white rounded-lg" aria-label="Edit"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button>
                                  <button type="button" onClick={() => requestDeleteSavedFood(food.id, food.food_name)} disabled={saving} className="p-1.5 text-[var(--color-text-muted)] hover:text-danger rounded-lg" aria-label="Delete"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )}

        {!loading && savedFoods.length === 0 && !showForm && (
          <p className="text-sm text-[var(--color-text-muted)] text-center py-6">No saved foods yet</p>
        )}
        
        {/* No Search Results */}
        {!loading && savedFoods.length > 0 && filteredFoods.length === 0 && !showForm && (
            <div className="stats-empty py-8">
                <div className="stats-empty__icon">
                    <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </div>
                <p className="stats-empty__body">No foods match your search</p>
            </div>
        )}

      {/* Delete Confirmation Modal */}
      {isDeleteConfirmOpen && itemToDelete && (
        <Modal isOpen={true} onClose={cancelDelete} title="Delete Food">
          <div className="space-y-6">
            <p className="text-[var(--color-text-secondary)]">
              Delete <span className="font-semibold text-[var(--color-text-primary)]">&ldquo;{itemToDelete.name}&rdquo;</span>?
            </p>
            <div className="flex gap-3">
                <button type="button" onClick={cancelDelete} disabled={saving} className="flex-1 btn-ghost py-3">Cancel</button>
                <button type="button" onClick={confirmDeleteSavedFood} disabled={saving} className="btn-danger">{saving ? 'Deleting…' : 'Delete'}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default SavedFoodManager; 