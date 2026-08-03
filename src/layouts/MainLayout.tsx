import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';

interface MainLayoutProps {
  session: Session; // Keep session for potential header use?
  handleLogout: () => void;
}

const MainLayout: React.FC<MainLayoutProps> = ({ handleLogout }) => {
  const navLinkClasses = ({ isActive }: { isActive: boolean }): string => 
    `flex flex-col items-center justify-center flex-1 py-4 text-sm font-medium transition-colors ${
      isActive 
        ? 'text-slate-700' 
        : 'text-stone-500 hover:text-slate-700'
    }`;

  return (
    <div className="flex flex-col min-h-screen bg-stone-50">
      {/* Enhanced Header */}
      <header className="border-b border-slate-100 px-6 py-4 bg-stone-50 shadow-sm">
        <div className="max-w-sm mx-auto flex justify-between items-center">
          <h1 className="text-xl font-semibold text-slate-700 tracking-tight">Macro Logger</h1>
          <button 
            onClick={handleLogout}
            className="text-stone-400 hover:text-slate-700 transition-colors p-1"
            aria-label="Logout"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </header>

      {/* Clean Main Content */}
      <main className="flex-grow px-6 py-8 pb-24">
        <div className="max-w-sm mx-auto">
          <Outlet />
        </div>
      </main>

      {/* Enhanced Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 shadow-lg">
        <div className="max-w-sm mx-auto flex">
          <NavLink to="/" className={navLinkClasses} end>
            <div className="w-6 h-6 mb-1">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <span>Add</span>
          </NavLink>
          
          <NavLink to="/today" className={navLinkClasses}>
            <div className="w-6 h-6 mb-1">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <span>Today</span>
          </NavLink>
          
          <NavLink to="/summary" className={navLinkClasses}>
            <div className="w-6 h-6 mb-1">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <span>Stats</span>
          </NavLink>
        </div>
      </nav>
    </div>
  );
};

export default MainLayout; 