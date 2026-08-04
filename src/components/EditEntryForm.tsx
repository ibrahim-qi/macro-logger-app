import React, { useState, useEffect } from 'react';

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
  };
  onSave: (updatedData: FoodEntryData & { id: number }) => Promise<void>;
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

  useEffect(() => {
    setFoodName(entry.food_name);
    setCalories(entry.calories.toString());
    setProtein(entry.protein?.toString() || '');
    setCarbs(entry.carbs?.toString() || '');
    setFats(entry.fats?.toString() || '');
    setQuantity(entry.quantity.toString());
    setErrorMessage(null);
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
    } catch (error: unknown) {
      console.error('Error saving entry:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to save entry. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errorMessage && <div className="alert-error">{errorMessage}</div>}

      <div>
        <label htmlFor="foodName" className="form-label">Food name</label>
        <input
          type="text"
          id="foodName"
          value={foodName}
          onChange={(e) => setFoodName(e.target.value)}
          className="input-premium"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="quantity" className="form-label">Quantity</label>
          <input
            type="number"
            id="quantity"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="input-premium"
            min="0.01"
            step="0.01"
            required
          />
        </div>
        <div>
          <label htmlFor="calories" className="form-label text-macro-calories">Calories (per qty)</label>
          <input
            type="number"
            id="calories"
            value={calories}
            onChange={(e) => setCalories(e.target.value)}
            className="input-premium"
            min="0"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label htmlFor="protein" className="form-label-sm text-macro-protein">Protein (g)</label>
          <input
            type="number"
            id="protein"
            value={protein}
            onChange={(e) => setProtein(e.target.value)}
            className="input-premium"
            min="0"
            step="0.1"
          />
        </div>
        <div>
          <label htmlFor="carbs" className="form-label-sm text-macro-carbs">Carbs (g)</label>
          <input
            type="number"
            id="carbs"
            value={carbs}
            onChange={(e) => setCarbs(e.target.value)}
            className="input-premium"
            min="0"
            step="0.1"
          />
        </div>
        <div>
          <label htmlFor="fats" className="form-label-sm text-macro-fats">Fats (g)</label>
          <input
            type="number"
            id="fats"
            value={fats}
            onChange={(e) => setFats(e.target.value)}
            className="input-premium"
            min="0"
            step="0.1"
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} disabled={isLoading} className="btn-secondary">
          Cancel
        </button>
        <button type="submit" disabled={isLoading} className="btn-primary !w-auto px-5">
          {isLoading ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  );
};

export default EditEntryForm;
