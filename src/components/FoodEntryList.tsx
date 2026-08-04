import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import type { Session } from '@supabase/supabase-js';
import Modal from './Modal';
import EditEntryForm from './EditEntryForm';
import GoalsSettingsForm from './GoalsSettingsForm';
import TodayHero from './TodayHero';
import DatePicker from './DatePicker';
import { TodayPageSkeleton } from './Skeleton';
import { computeStreak, datesFromTimestamps } from '../utils/streak';
import TabNavigation from './TabNavigation';
import EntriesTab from './EntriesTab';
import GoalsTab from './GoalsTab';
import { formatLocalDateKey, localDayBounds } from '../utils/localDate';
import { useUserExperience } from '../context/UserExperienceContext';
import { useToast } from '../context/ToastContext';
import { getDeleteEntryBody, getDeleteEntryTitle, getLogSuccessToast } from '../copy/experience';

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

const formatDate = (date: Date): string => formatLocalDateKey(date);

// Helper function to check if a date is today
const isToday = (date: Date): boolean => {
  const today = new Date();
  return date.toDateString() === today.toDateString();
};

const FoodEntryList: React.FC<FoodEntryListProps> = ({ session }) => {
  const location = useLocation();
  const { showToast } = useToast();
  const { refresh: refreshExperience } = useUserExperience();
  const [entries, setEntries] = useState<FoodEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [displayedDate, setDisplayedDate] = useState(new Date());
  const [highlightLoggedAfter, setHighlightLoggedAfter] = useState<number | null>(null);
  
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
  const [streak, setStreak] = useState(0);
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
    const { dayStart, dayEnd, dateKey } = localDayBounds(date);

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
      setError(`Failed to load entries for ${dateKey}: ${err.message}`);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [session.user.id]);

  // Function to fetch user goals
  const fetchStreak = useCallback(async () => {
    try {
      const since = new Date();
      since.setDate(since.getDate() - 60);
      const { data, error } = await supabase
        .from('food_entries')
        .select('created_at')
        .eq('user_id', session.user.id)
        .gte('created_at', since.toISOString());
      if (error) throw error;
      setStreak(computeStreak(datesFromTimestamps((data ?? []).map((r) => r.created_at))));
    } catch {
      setStreak(0);
    }
  }, [session.user.id]);

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
          setUserGoals(null);
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
      fetchStreak();
      refreshExperience();

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
      fetchStreak();
    }
  }, [session, displayedDate, fetchEntries, fetchUserGoals, fetchStreak]);

  useEffect(() => {
    const state = location.state as {
      logSuccess?: { calories: number; loggedAt: number };
    } | null;

    if (state?.logSuccess) {
      showToast(getLogSuccessToast(state.logSuccess.calories));
      setHighlightLoggedAfter(state.logSuccess.loggedAt - 2000);
      setDisplayedDate(new Date());
      setActiveTab('entries');
      window.history.replaceState({}, document.title);
      window.setTimeout(() => setHighlightLoggedAfter(null), 8000);
    }
  }, [location.state, showToast]);

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
             fetchStreak();
             refreshExperience();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };

  }, [session, displayedDate, fetchStreak, refreshExperience]);

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
    fetchUserGoals();
    refreshExperience();
  };


  if (loading) {
    return <TodayPageSkeleton />;
  }

  if (error) {
    return <p className="text-center text-danger py-4 text-sm">{error}</p>;
  }

  return (
    <div className="today-page">
      <DatePicker
        selectedDate={displayedDate}
        onDateChange={setDisplayedDate}
        layout="nav"
        onPrevious={goToPreviousDay}
        onNext={goToNextDay}
        disableNext={isToday(displayedDate)}
        onJumpToday={() => setDisplayedDate(new Date())}
      />

      {isToday(displayedDate) && (
        <TodayHero
          dailyTotals={dailyTotals}
          userGoals={userGoals}
          streak={streak}
        />
      )}

      <TabNavigation
        tabs={[
          { id: 'entries', label: 'Meals' },
          { id: 'goals', label: 'Targets' },
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        className="segment-tabs--minimal"
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
            showDayTotals={!isToday(displayedDate)}
            highlightLoggedAfter={highlightLoggedAfter}
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
        <Modal isOpen={true} onClose={cancelDelete} title={getDeleteEntryTitle()}>
          <div className="space-y-6">
            <p className="type-body-sm text-[var(--color-text-secondary)]">{getDeleteEntryBody()}</p>
            <div className="flex gap-3">
              <button onClick={cancelDelete} className="flex-1 btn-ghost py-3">Cancel</button>
              <button type="button" onClick={confirmDeleteEntry} className="btn-danger">
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