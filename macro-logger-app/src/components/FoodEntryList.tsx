import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import type { Session } from '@supabase/supabase-js';
import Modal from './Modal'; // Import the Modal component
import EditEntryForm from './EditEntryForm'; // Import the EditEntryForm component
// We'll create EditEntryForm later

// Define the structure of a food entry based on our table
interface FoodEntry {
  id: number;
  created_at: string;
  food_name: string;
  calories: number;
  protein: number | null;
  carbs: number | null;
  fats: number | null;
  quantity: number;
}

// Interface for the data to be updated in Supabase
interface FoodEntryUpdateData {
    food_name: string;
    calories: number;
    protein: number | null;
    carbs: number | null;
    fats: number | null;
    quantity: number;
    // user_id and created_at should not be updated directly by the user edit form
}

interface FoodEntryListProps {
  session: Session;
  // We\'ll add a way to trigger refresh later
}

// Helper function to format a Date object as YYYY-MM-DD
const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

// Helper function to check if a date is today
const isToday = (date: Date): boolean => {
  const today = new Date();
  return date.toDateString() === today.toDateString();
};

const FoodEntryList: React.FC<FoodEntryListProps> = ({ session }) => {
  const [entries, setEntries] = useState<FoodEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [displayedDate, setDisplayedDate] = useState(new Date()); // State for the displayed date
  
  // State for Edit Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [entryToEdit, setEntryToEdit] = useState<FoodEntry | null>(null);

  // State for Delete Confirmation Modal
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [itemIdToDelete, setItemIdToDelete] = useState<number | null>(null);

  // Calculate daily totals
  const dailyTotals = React.useMemo(() => {
    return entries.reduce(
      (acc, entry) => {
        acc.calories += (entry.calories || 0) * (entry.quantity || 1);
        acc.protein += (entry.protein || 0) * (entry.quantity || 1);
        acc.carbs += (entry.carbs || 0) * (entry.quantity || 1);
        acc.fats += (entry.fats || 0) * (entry.quantity || 1);
        return acc;
      },
      { calories: 0, protein: 0, carbs: 0, fats: 0 }
    );
  }, [entries]);

  // Function to fetch entries for a specific date
  const fetchEntries = useCallback(async (date: Date) => {
    setLoading(true);
    setError(null);
    const dateString = formatDate(date);
    const dayStart = `${dateString} 00:00:00`;
    const dayEnd = `${dateString} 23:59:59`;

    try {
      const { data, error: fetchError } = await supabase
        .from('food_entries')
        .select('*')
        .eq('user_id', session.user.id)
        .gte('created_at', dayStart)
        .lte('created_at', dayEnd)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setEntries(data || []);
    } catch (err: any) {
      console.error('Error fetching food entries:', err);
      setError(`Failed to load entries for ${dateString}: ${err.message}`);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [session.user.id]); // Dependency on session.user.id

  // Function to handle deleting an entry
  // Step 1: Open the confirmation modal
  const requestDeleteEntry = (entryId: number) => {
    setItemIdToDelete(entryId);
    setIsDeleteConfirmOpen(true);
    setError(null); // Clear previous errors
  };

  // Step 2: Close the confirmation modal
  const cancelDelete = () => {
    setIsDeleteConfirmOpen(false);
    setItemIdToDelete(null);
  };

  // Step 3: Execute the deletion if confirmed
  const confirmDeleteEntry = async () => {
    if (itemIdToDelete === null) return; // Should not happen, but good practice

    const entryId = itemIdToDelete;
    cancelDelete(); // Close the modal first

    try {
      const { error: deleteError } = await supabase
        .from('food_entries')
        .delete()
        .match({ id: entryId });

      if (deleteError) throw deleteError;

      // Remove the entry from the local state
      setEntries(currentEntries => currentEntries.filter(entry => entry.id !== entryId));

    } catch (err: any) {
      console.error('Error deleting entry:', err);
      setError(`Failed to delete entry: ${err.message}`);
      // Optional: Clear error after a few seconds
      setTimeout(() => setError(null), 5000); 
    }
  };

  // Effect for initial fetch and fetching when date changes
  useEffect(() => {
    if (session) {
      fetchEntries(displayedDate);
    }
  }, [session, displayedDate, fetchEntries]); // Add displayedDate and fetchEntries

  // Effect for Realtime subscription
  useEffect(() => {
    if (!session) return;

    // Only subscribe if viewing today, or adjust logic as needed
    // For simplicity, we'll only auto-add if viewing today
    
    const channel = supabase
      .channel('food_entries_realtime')
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'food_entries', 
          filter: `user_id=eq.${session.user.id}` 
        },
        (payload) => {
          // Check if the new entry belongs to the currently displayed date *and* it's today
          const newEntryDate = new Date(payload.new.created_at);
          if (isToday(displayedDate) && formatDate(newEntryDate) === formatDate(displayedDate)) {
             console.log('New entry received for today:', payload);
             setEntries(currentEntries => [payload.new as FoodEntry, ...currentEntries].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };

  }, [session, displayedDate]); // Depend on session and displayedDate

  // --- Edit Modal Handlers ---
  const handleOpenEditModal = (entry: FoodEntry) => {
    setEntryToEdit(entry);
    setIsEditModalOpen(true);
    setError(null); // Clear any previous global errors when opening modal
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setEntryToEdit(null); // Clear the entry being edited
  };

  // Renamed from handleEntryUpdate to handleUpdateEntry for clarity and consistency
  const handleUpdateEntry = async (updatedData: FoodEntryUpdateData & { id: number }) => {
    if (!entryToEdit) return; // Should not happen if modal is open with an entry

    setError(null);

    try {
      const { data, error: updateError } = await supabase
        .from('food_entries')
        .update({
          food_name: updatedData.food_name,
          calories: updatedData.calories,
          protein: updatedData.protein,
          carbs: updatedData.carbs,
          fats: updatedData.fats,
          quantity: updatedData.quantity,
          // Note: We don't update created_at or user_id here.
          // Supabase automatically updates an 'updated_at' column if it exists and is configured for auto-update.
          // We don't have one explicitly, but good to keep in mind.
        })
        .eq('id', updatedData.id)
        .eq('user_id', session.user.id) // Ensure user can only update their own entries
        .select() // Select the updated row to get the latest data back
        .single(); // Expect a single row to be returned

      if (updateError) throw updateError;

      if (data) {
        // Update the entry in the main list state
        // The `data` returned from Supabase is the updated entry object
        setEntries(currentEntries => 
          currentEntries.map(entry => 
            entry.id === data.id ? { ...entry, ...data } : entry
          ).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) // Re-sort, as updated item might have its `created_at` effectively changed by `select()` returning full row?
                                                                                                // Or more likely, if we ever allow changing the date/time of an entry, this would be crucial.
                                                                                                // For now, it primarily ensures consistency if local sort was different.
        );
        handleCloseEditModal(); // Close modal after successful update
        // Optional: Show success message?
      } else {
        // This case should ideally not be reached if .single() is used and an error isn't thrown
        throw new Error("No data returned after update.");
      }

    } catch (err: any) {
      console.error('Error updating entry:', err);
      setError(`Failed to update entry: ${err.message}`);
      // The error will be displayed in EditEntryForm, but we could also set a global error here if desired
      // For now, let EditEntryForm handle its own error display during submission
      throw err; // Re-throw to allow EditEntryForm to catch it and manage its loading/error state
    }
  };
  // --- End Edit Modal Handlers ---

  const goToPreviousDay = () => {
    setDisplayedDate(prevDate => {
      const newDate = new Date(prevDate);
      newDate.setDate(newDate.getDate() - 1);
      return newDate;
    });
  };

  const goToNextDay = () => {
    setDisplayedDate(prevDate => {
      const newDate = new Date(prevDate);
      newDate.setDate(newDate.getDate() + 1);
      return newDate;
    });
  };


  if (loading) {
    return <p className="text-center text-stone-500 py-4">Loading entries...</p>;
  }

  if (error) {
    return <p className="text-center text-stone-500 py-4">{error}</p>;
  }

  return (
    <div>
      {/* Minimal Date Header */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={goToPreviousDay}
          className="p-2 hover:bg-stone-100 rounded-full transition-colors"
          aria-label="Previous day"
        >
          <svg className="w-5 h-5 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        
        <div className="text-center">
          <h2 className="text-lg font-medium text-stone-900">
            {isToday(displayedDate) ? 'Today' : displayedDate.toLocaleDateString('en-US', { 
              weekday: 'short', 
              month: 'short', 
              day: 'numeric' 
            })}
          </h2>
          {!isToday(displayedDate) && (
            <button
              onClick={() => setDisplayedDate(new Date())}
              className="text-xs text-stone-500 hover:text-stone-700 mt-1"
            >
              Jump to today
            </button>
          )}
        </div>
        
        <button
          onClick={goToNextDay}
          disabled={isToday(displayedDate)}
          className="p-2 hover:bg-stone-100 rounded-full transition-colors disabled:opacity-30"
          aria-label="Next day"
        >
          <svg className="w-5 h-5 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Daily Totals Card */}
      {entries.length > 0 && (
        <div className="mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-stone-100 p-6">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="text-2xl font-light text-slate-700">{dailyTotals.calories.toFixed(0)}</div>
                <div className="text-xs text-stone-500 uppercase tracking-wide">Calories</div>
              </div>
              <div>
                <div className="text-lg font-light text-stone-700">{dailyTotals.protein.toFixed(1)}g</div>
                <div className="text-xs text-stone-500 uppercase tracking-wide">Protein</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {entries.length === 0 && (
        <div className="text-center py-12">
          <div className="text-stone-400 mb-4">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <p className="text-sm text-stone-500">No entries for this day</p>
        </div>
      )}

      {/* Food Entries Card */}
      {entries.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-stone-100 overflow-hidden">
          <div className="divide-y divide-stone-50">
            {entries.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between p-4">
                <div className="flex-1 mr-4">
                  <p className="font-medium text-stone-900 capitalize">{entry.food_name}</p>
                  <div className="flex items-center space-x-4 mt-1 text-sm text-stone-500">
                    <span>{new Date(entry.created_at).toLocaleTimeString([], { hour: 'numeric', minute:'2-digit' })}</span>
                    <span>×{entry.quantity}</span>
                    <span>{(entry.calories * entry.quantity).toFixed(0)} cal</span>
                    {(entry.protein ?? 0) > 0 && <span>{((entry.protein ?? 0) * entry.quantity).toFixed(1)}g protein</span>}
                  </div>
                </div>
                
                <div className="flex space-x-2">
                  <button 
                    onClick={() => handleOpenEditModal(entry)}
                    className="p-2 text-stone-400 hover:text-slate-700 transition-colors"
                    aria-label={`Edit ${entry.food_name}`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  
                  <button 
                    onClick={() => requestDeleteEntry(entry.id)}
                    className="p-2 text-stone-400 hover:text-red-500 transition-colors"
                    aria-label={`Delete ${entry.food_name}`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && entryToEdit && (
        <Modal isOpen={true} onClose={handleCloseEditModal} title="Edit Entry">
          <EditEntryForm 
            entry={entryToEdit} 
            onSave={handleUpdateEntry} 
            onCancel={handleCloseEditModal} 
          />
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteConfirmOpen && (
        <Modal isOpen={true} onClose={cancelDelete} title="Delete Entry">
          <div className="space-y-6">
            <p className="text-stone-600">Are you sure you want to delete this entry?</p>
            <div className="flex space-x-3">
              <button
                onClick={cancelDelete}
                className="flex-1 py-3 px-4 border border-stone-200 text-stone-700 rounded-xl hover:bg-stone-50 transition-colors focus:outline-none focus:ring-2 focus:ring-stone-300"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteEntry}
                className="flex-1 py-3 px-4 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-400"
              >
                Delete
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default FoodEntryList; 