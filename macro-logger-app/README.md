# Macro Logger App

A simple web application designed to help track daily calories and macronutrient intake. Built for easy mobile use, particularly for iPhone users, with PWA (Progressive Web App) features allowing it to be added to the home screen.

## Features

*   **Food Entry:** Manually input food items with their name, calories, protein, carbs, fats, and quantity.
*   **Daily Log:** View a list of all food entries for the current day or navigate to previous/next days.
*   **Daily Totals:** See a running total of calories and macros for the selected day on the "Today" page.
*   **Saved Foods:** Save frequently eaten foods as templates for quick re-entry.
    *   Search functionality for saved foods.
    *   Populate the food entry form directly from a saved food.
*   **Summaries:** View weekly and monthly summaries of total and average macronutrient intake.
*   **User Authentication:** Secure login and signup functionality using Supabase Auth.
*   **PWA Ready:** Can be "Added to Home Screen" on mobile devices for an app-like experience.
*   **Responsive Design:** Styled with Tailwind CSS for a clean, mobile-first experience.

## Technology Stack

*   **Frontend:**
    *   React (with Vite)
    *   TypeScript
    *   Tailwind CSS
    *   React Router for navigation
*   **Backend (BaaS):**
    *   Supabase (PostgreSQL database, Authentication, Realtime subscriptions)
*   **PWA:**
    *   `vite-plugin-pwa`

## Project Setup & Local Development

Follow these steps to get the project running locally:

1.  **Clone the Repository:**
    ```bash
    git clone <your-repository-url>
    cd macro-logger-app
    ```

2.  **Install Dependencies:**
    ```bash
    npm install
    # or
    # yarn install
    # or
    # pnpm install
    ```

3.  **Set Up Environment Variables:**
    *   Create a file named `.env.local` in the root of the `macro-logger-app` project directory (alongside `package.json`).
    *   Add your Supabase project URL and anon key to this file:
        ```env
        VITE_SUPABASE_URL=your_supabase_project_url
        VITE_SUPABASE_ANON_KEY=your_supabase_public_anon_key
        ```
    *   You can find these in your Supabase project settings.

4.  **Supabase Setup (If starting from scratch):**
    *   **Project:** Create a new project on [Supabase](https://supabase.com/).
    *   **Tables:**
        *   `food_entries`:
            *   `id` (int8, primary key, auto-incrementing)
            *   `created_at` (timestamptz, default now())
            *   `user_id` (uuid, references `auth.users.id`)
            *   `food_name` (text, not null)
            *   `calories` (numeric, not null)
            *   `protein` (numeric)
            *   `carbs` (numeric)
            *   `fats` (numeric)
            *   `quantity` (numeric, default 1, not null)
        *   `saved_foods`:
            *   `id` (int8, primary key, auto-incrementing)
            *   `created_at` (timestamptz, default now())
            *   `user_id` (uuid, references `auth.users.id`)
            *   `food_name` (text, not null)
            *   `calories` (numeric, not null)
            *   `protein` (numeric)
            *   `carbs` (numeric)
            *   `fats` (numeric)
            *   **Unique Constraint:** Add a unique constraint on (`user_id`, `food_name`).
    *   **Row Level Security (RLS):**
        *   Enable RLS for both `food_entries` and `saved_foods` tables.
        *   Add policies to allow users to perform `SELECT`, `INSERT`, `UPDATE`, `DELETE` operations only on their own records (typically using `auth.uid() = user_id`).
    *   **SQL Functions (for Summaries):**
        *   Create the `get_weekly_summary` and `get_monthly_summary` SQL functions in the Supabase SQL Editor. The definitions for these functions are specific to the project and calculate macro totals.
        *   Ensure these functions correctly handle `quantity` by multiplying macros by quantity (e.g., `SUM(calories * quantity)`).
    *   **Realtime:**
        *   Enable Supabase Realtime for the `food_entries` table if you want new entries to appear automatically on the "Today" page when viewing the current day. (Go to Database > Replication and enable for the table).

5.  **Run the Development Server:**
    ```bash
    npm run dev
    ```
    This will usually start the app on `http://localhost:5173`.
    To access it from other devices on your local network (e.g., your iPhone for testing PWA):
    ```bash
    npm run dev -- --host
    ```

## Building for Production

To create a production build:

```bash
npm run build
```
The production files will be located in the `dist` directory.

## PWA Icons & Manifest

*   Ensure the following icons are present in the `public` directory:
    *   `pwa-192x192.png`
    *   `pwa-512x512.png`
    *   `apple-touch-icon.png`
*   The `vite.config.ts` file contains the PWA manifest configuration. Update `theme_color` and other details as needed.
*   `index.html` includes necessary meta tags for PWA functionality, especially for iOS.

---

This project was bootstrapped with [Vite](https://vitejs.dev/).
