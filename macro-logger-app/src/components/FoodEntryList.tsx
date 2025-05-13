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

  const navButtonClasses = "px-3 py-1.5 sm:px-4 sm:py-2 text-sm font-medium rounded-lg transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed";
  const todayButtonClasses = `${navButtonClasses} bg-blue-100 text-blue-700 hover:bg-blue-200`;
  const arrowButtonClasses = `${navButtonClasses} bg-gray-200 text-gray-700 hover:bg-gray-300`;

  if (loading) {
    return <p className="text-center text-gray-500 py-4">Loading entries...</p>;
  }

  if (error) {
    return <p className="text-center text-gray-500 py-4">{error}</p>;
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-4">
        <h2 className="text-xl sm:text-2xl font-semibold text-gray-800 order-2 sm:order-1">
          Entries for: <span className="text-blue-600">{displayedDate.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </h2>
        <div className="flex items-center gap-2 order-1 sm:order-2">
          <button onClick={goToPreviousDay} className={arrowButtonClasses} aria-label="Previous day">
            <span className="material-icons-outlined">chevron_left</span>
          </button>
          {!isToday(displayedDate) && (
            <button 
              onClick={() => setDisplayedDate(new Date())} 
              className={todayButtonClasses}
              aria-label="Go to today"
            >
              Today
            </button>
          )}
          <button onClick={goToNextDay} disabled={isToday(displayedDate)} className={arrowButtonClasses} aria-label="Next day">
            <span className="material-icons-outlined">chevron_right</span>
          </button>
        </div>
      </div>

      {/* Daily Totals Display */}
      {!loading && entries.length > 0 && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg shadow-sm">
          <h3 className="text-md sm:text-lg font-semibold text-blue-700 mb-2 text-center">Daily Totals</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-sm">
            <div><strong>Calories:</strong> <span className="text-gray-800 float-right">{dailyTotals.calories.toFixed(0)} kcal</span></div>
            <div><strong>Protein:</strong> <span className="text-gray-800 float-right">{dailyTotals.protein.toFixed(1)} g</span></div>
            <div><strong>Carbs:</strong> <span className="text-gray-800 float-right">{dailyTotals.carbs.toFixed(1)} g</span></div>
            <div><strong>Fats:</strong> <span className="text-gray-800 float-right">{dailyTotals.fats.toFixed(1)} g</span></div>
          </div>
        </div>
      )}

      {entries.length === 0 ? (
        <div className="text-center text-gray-400 py-10 px-4">
          <span className="material-icons-outlined text-5xl mb-3 opacity-70">summarize</span>
          <p className="text-lg font-medium text-gray-600 mb-1">No entries for this day.</p>
          {isToday(displayedDate) ? (
            <p className="text-sm text-gray-500">Log some food on the 'Log' tab to see it here!</p>
          ) : (
            <p className="text-sm text-gray-500">Try another date or add entries for this day.</p>
          )}
        </div>
      ) : (
        // Increased spacing between list items
        <ul className="space-y-3 sm:space-y-4">
          {entries.map((entry) => (
            <li 
              key={entry.id} 
              // Adjusted padding, border, hover effect, shadow
              className="flex items-center justify-between gap-3 sm:gap-4 p-3 sm:p-4 border border-gray-200/70 rounded-lg bg-white shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-150"
            >
              {/* Left Side: Name and Time - Adjusted text styles */}
              <div className="flex-grow mr-2 overflow-hidden">
                <p className="text-base font-medium text-gray-900 truncate capitalize">{entry.food_name}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {new Date(entry.created_at).toLocaleTimeString([], { hour: 'numeric', minute:'2-digit' })}
                </p>
              </div>

              {/* Right Side: Macros, Qty, Actions */}
              <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
                 {/* Macros & Qty - Adjusted text styles and spacing */}
                 <div className="text-right">
                    <p className="text-sm font-semibold text-blue-600">{(entry.calories * entry.quantity).toFixed(0)} kcal</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {/* Nicer formatting for macros */}
                      Qty: <span className="font-medium text-gray-600">{entry.quantity}</span> | P: <span className="font-medium text-gray-600">{((entry.protein ?? 0) * entry.quantity).toFixed(1)}g</span>
                    </p>
                 </div>
                 
                 {/* Action Buttons Container */}
                 <div className="flex items-center border-l border-gray-200 pl-2 sm:pl-3 space-x-1">
                    {/* Edit Button - Slightly larger tap area, adjusted hover */}
                    <button 
                        onClick={() => handleOpenEditModal(entry)}
                        className="p-1.5 rounded-md text-blue-600 hover:text-blue-800 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1 transition-colors"
                        aria-label={`Edit entry ${entry.food_name}`}
                    >
                        <span className="material-icons-outlined text-xl leading-none">edit</span>
                    </button>

                    {/* Delete Button - Slightly larger tap area, adjusted hover */}
                    <button 
                        onClick={() => requestDeleteEntry(entry.id)}
                        className="p-1.5 rounded-md text-red-500 hover:text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-1 transition-colors"
                        aria-label={`Delete entry ${entry.food_name}`}
                    >
                        <span className="material-icons-outlined text-xl leading-none">delete</span>
                    </button>
                 </div>
               </div>
            </li>
          ))}
        </ul>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && entryToEdit && (
        <Modal isOpen={true} onClose={handleCloseEditModal} title="Edit Food Entry">
            <EditEntryForm 
                 entry={entryToEdit} 
                 onSave={handleUpdateEntry} 
                 onCancel={handleCloseEditModal} 
            />
        </Modal>
       )}

      {/* Delete Confirmation Modal */}
      {isDeleteConfirmOpen && (
        <Modal isOpen={true} onClose={cancelDelete} title="Confirm Deletion">
          <div className="space-y-4">
            <p className="text-gray-700">Are you sure you want to delete this food entry?</p>
            <p className="text-sm text-gray-500">This action cannot be undone.</p>
            <div className="flex justify-end space-x-3 pt-2">
                <button
                  onClick={cancelDelete}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteEntry}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
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