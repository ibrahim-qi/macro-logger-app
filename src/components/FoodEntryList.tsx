import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import type { Session } from '@supabase/supabase-js';
import Modal from './Modal'; // Import the Modal component
import EditEntryForm from './EditEntryForm'; // Import the EditEntryForm component
import GoalsSettingsForm from './GoalsSettingsForm'; // Import the goals settings form
import TabNavigation from './TabNavigation'; // Import the tab navigation
import EntriesTab from './EntriesTab'; // Import the entries tab
import GoalsTab from './GoalsTab'; // Import the goals tab

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

  // State for Goals Settings Modal
  const [isGoalsModalOpen, setIsGoalsModalOpen] = useState(false);

  // Tab Navigation State
  const [activeTab, setActiveTab] = useState('entries');

  // User Goals State (for GoalsTab)
  const [userGoals, setUserGoals] = useState<{
    daily_calories_goal: number;
    daily_protein_goal: number;
    daily_carbs_goal: number;
    daily_fats_goal: number;
  } | null>(null);
  const [goalsLoading, setGoalsLoading] = useState(true);

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
  }, [session.user.id]);

  // Function to fetch user goals
  const fetchUserGoals = useCallback(async () => {
    try {
      setGoalsLoading(true);

      const { data, error } = await supabase
        .from('user_goals')
        .select('daily_calories_goal, daily_protein_goal, daily_carbs_goal, daily_fats_goal')
        .eq('user_id', session.user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No goals set yet - create default goals
          const { data: insertData, error: insertError } = await supabase
            .from('user_goals')
            .insert({
              user_id: session.user.id,
              daily_calories_goal: 2000,
              daily_protein_goal: 150,
              daily_carbs_goal: 250,
              daily_fats_goal: 65
            })
            .select('daily_calories_goal, daily_protein_goal, daily_carbs_goal, daily_fats_goal')
            .single();

          if (insertError) throw insertError;
          setUserGoals(insertData);
        } else {
          throw error;
        }
      } else {
        setUserGoals(data);
      }
    } catch (err: any) {
      console.error('Error fetching user goals:', err);
      setUserGoals(null);
    } finally {
      setGoalsLoading(false);
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
      fetchUserGoals();
    }
  }, [session, displayedDate, fetchEntries, fetchUserGoals]); // Add fetchUserGoals

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

  // Goals Modal Handlers
  const handleGoalsClick = () => {
    setIsGoalsModalOpen(true);
  };

  const handleGoalsClose = () => {
    setIsGoalsModalOpen(false);
  };

  const handleGoalsUpdated = () => {
    fetchUserGoals(); // Refresh user goals when they're updated
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
      <div className="flex items-center justify-between mb-6">
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

      {/* Tab Navigation */}
      <TabNavigation
        tabs={[
          { id: 'entries', label: 'Entries' },
          { id: 'goals', label: 'Goals' }
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        className="mb-6"
      />

      {/* Tab Content */}
      <div className="relative">
        {activeTab === 'entries' ? (
          <EntriesTab
            entries={entries}
            dailyTotals={dailyTotals}
            onEditEntry={handleOpenEditModal}
            onDeleteEntry={requestDeleteEntry}
            isActive={true}
          />
        ) : (
          <GoalsTab
            dailyTotals={dailyTotals}
            userGoals={userGoals}
            loading={goalsLoading}
            selectedDate={displayedDate}
            onGoalsClick={handleGoalsClick}
            isActive={true}
          />
        )}
      </div>

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

      {/* Goals Settings Modal */}
      <GoalsSettingsForm
        session={session}
        isOpen={isGoalsModalOpen}
        onClose={handleGoalsClose}
        onGoalsUpdated={handleGoalsUpdated}
      />
    </div>
  );
};

export default FoodEntryList; 