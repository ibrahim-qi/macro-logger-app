import React, { useState, useEffect } from 'react';

// Interface for the props
interface FoodEntryData {
  food_name: string;
  calories: number;
  protein: number | null;
  carbs: number | null;
  fats: number | null;
  quantity: number;
}

interface EditEntryFormProps {
  entry: {
    id: number;
    food_name: string;
    calories: number;
    protein: number | null;
    carbs: number | null;
    fats: number | null;
    quantity: number;
    // We don't need created_at or user_id for the form itself, but they are part of the original entry
  };
  onSave: (updatedData: FoodEntryData & { id: number }) => Promise<void>; // onSave will handle the actual DB update
  onCancel: () => void;
}

const EditEntryForm: React.FC<EditEntryFormProps> = ({ entry, onSave, onCancel }) => {
  const [foodName, setFoodName] = useState(entry.food_name);
  const [calories, setCalories] = useState(entry.calories.toString());
  const [protein, setProtein] = useState(entry.protein?.toString() || '');
  const [carbs, setCarbs] = useState(entry.carbs?.toString() || '');
  const [fats, setFats] = useState(entry.fats?.toString() || '');
  const [quantity, setQuantity] = useState(entry.quantity.toString());
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Effect to reset form if the entry prop changes (e.g. user opens edit for another item while modal is somehow kept open)
  useEffect(() => {
    setFoodName(entry.food_name);
    setCalories(entry.calories.toString());
    setProtein(entry.protein?.toString() || '');
    setCarbs(entry.carbs?.toString() || '');
    setFats(entry.fats?.toString() || '');
    setQuantity(entry.quantity.toString());
    setErrorMessage(null); // Clear any previous error messages
  }, [entry]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    const parsedCalories = parseInt(calories, 10);
    const parsedQuantity = parseInt(quantity, 10);

    if (isNaN(parsedCalories) || parsedCalories < 0) {
      setErrorMessage('Calories must be a non-negative number.');
      setIsLoading(false);
      return;
    }
    if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
      setErrorMessage('Quantity must be a positive number.');
      setIsLoading(false);
      return;
    }
    if (!foodName.trim()) {
        setErrorMessage('Food name cannot be empty.');
        setIsLoading(false);
        return;
    }

    const updatedData: FoodEntryData & { id: number } = {
      id: entry.id,
      food_name: foodName.trim(),
      calories: parsedCalories,
      protein: protein ? parseFloat(protein) : null,
      carbs: carbs ? parseFloat(carbs) : null,
      fats: fats ? parseFloat(fats) : null,
      quantity: parsedQuantity,
    };

    try {
      await onSave(updatedData);
      // onSave prop is expected to close the modal on success
    } catch (error: any) {
      console.error("Error saving entry:", error);
      setErrorMessage(error.message || 'Failed to save entry. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass = "mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors";
  const labelClass = "block text-sm font-medium text-gray-700 mb-0.5";

  return (
    <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
      {errorMessage && (
        <div className="p-3 mb-2 border border-red-300 bg-red-100 text-red-800 rounded-md text-sm">
          <p>{errorMessage}</p>
        </div>
      )}
      <div>
        <label htmlFor="foodName" className={labelClass}>Food Name</label>
        <input
          type="text"
          id="foodName"
          value={foodName}
          onChange={(e) => setFoodName(e.target.value)}
          className={inputClass}
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div>
          <label htmlFor="quantity" className={labelClass}>Quantity</label>
          <input
            type="number"
            id="quantity"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className={inputClass}
            min="0.1"
            step="0.1"
            required
          />
        </div>
        <div>
          <label htmlFor="calories" className={labelClass}>Calories (per one quantity)</label>
          <input
            type="number"
            id="calories"
            value={calories}
            onChange={(e) => setCalories(e.target.value)}
            className={inputClass}
            min="0"
            required
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <div>
          <label htmlFor="protein" className={labelClass}>Protein (g)</label>
          <input
            type="number"
            id="protein"
            value={protein}
            onChange={(e) => setProtein(e.target.value)}
            className={inputClass}
            min="0"
            step="0.1"
          />
        </div>
        <div>
          <label htmlFor="carbs" className={labelClass}>Carbs (g)</label>
          <input
            type="number"
            id="carbs"
            value={carbs}
            onChange={(e) => setCarbs(e.target.value)}
            className={inputClass}
            min="0"
            step="0.1"
          />
        </div>
        <div>
          <label htmlFor="fats" className={labelClass}>Fats (g)</label>
          <input
            type="number"
            id="fats"
            value={fats}
            onChange={(e) => setFats(e.target.value)}
            className={inputClass}
            min="0"
            step="0.1"
          />
        </div>
      </div>
      <div className="flex justify-end space-x-3 pt-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 disabled:opacity-60 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-60 transition-colors"
        >
          {isLoading ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
};

export default EditEntryForm; 