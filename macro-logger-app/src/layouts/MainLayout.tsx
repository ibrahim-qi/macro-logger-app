import React from 'react';
import { Outlet, Link, NavLink } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';

interface MainLayoutProps {
  session: Session; // Keep session for potential header use?
  handleLogout: () => void;
}

const MainLayout: React.FC<MainLayoutProps> = ({ handleLogout }) => {
  // Define NavLink active/inactive classes
  const navLinkClasses = ({ isActive }: { isActive: boolean }): string => 
    // Updated classes for better visual distinction
    `flex flex-col items-center justify-center px-2 py-1.5 w-1/3 text-xs font-medium transition-colors duration-150 rounded-md ${
      isActive 
        ? 'bg-blue-800 text-white' // Active state: Med-dark blue background, white text
        : 'text-blue-300 hover:text-white hover:bg-blue-700' // Inactive state: Lighter blue text, hover to white text & med blue bg
    }`;

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 text-gray-800"> {/* Slightly lighter page background */}
      {/* Header - Updated to Navy Blue Theme */}
      <header className="sticky top-0 z-20 bg-blue-900 text-white shadow-md px-4 sm:px-6 lg:px-8 py-3">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <h1 className="text-xl sm:text-2xl font-bold">Macro Logger</h1> {/* text-indigo-700 removed */}
          {/* Logout button with icon */}
          <button 
            onClick={handleLogout}
            className="p-2 rounded-full hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-blue-900 transition-colors duration-150"
            aria-label="Logout"
          >
            <span className="material-icons-outlined">logout</span>
          </button>
        </div>
      </header>

      {/* Main Content Area - Use max-w-5xl consistent with header, adjust padding */}
      <main className="flex-grow max-w-5xl w-full mx-auto px-3 py-4 sm:px-5 sm:py-6 lg:px-8 mb-20"> {/* Increased bottom margin for nav */}
        <Outlet />
      </main>

      {/* Bottom Navigation - Updated for Navy Blue Theme */}
      <nav className="fixed bottom-0 left-0 right-0 z-10 bg-blue-900 border-t border-blue-800 shadow-lg-top">
        {/* Use max-w-5xl, increased height slightly, added some internal padding */}
        <div className="max-w-5xl mx-auto flex justify-around items-center h-[68px] px-2 sm:px-4">
          {/* Using navLinkClasses defined above */}
          <NavLink to="/" className={navLinkClasses} end>
            <span className="material-icons-outlined mb-0.5">edit_note</span>
            <span>Log</span>
          </NavLink>
          <NavLink to="/today" className={navLinkClasses}>
            <span className="material-icons-outlined mb-0.5">event_note</span>
            <span>Today</span>
          </NavLink>
          <NavLink to="/summary" className={navLinkClasses}>
            <span className="material-icons-outlined mb-0.5">leaderboard</span>
            <span>Summary</span>
          </NavLink>
        </div>
      </nav>
    </div>
  );
};

export default MainLayout; 