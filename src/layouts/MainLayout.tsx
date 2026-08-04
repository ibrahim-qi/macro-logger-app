import React from 'react';
import { Outlet, NavLink, useLocation, Link } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { SahhaWordmark } from '../components/SahhaBrand';

interface MainLayoutProps {
  session: Session;
  handleLogout: () => void;
}

const MainLayout: React.FC<MainLayoutProps> = ({ handleLogout }) => {
  const location = useLocation();
  const isLog = location.pathname === '/log';
  const isToday = location.pathname === '/';
  const isStats = location.pathname === '/summary';

  return (
    <div className="app-shell app-bg">
      <header className="app-bar safe-x">
        <div className="app-container app-bar__inner app-bar__inner--centered">
          <div className="app-bar__side" aria-hidden="true" />

          <Link to="/" className="app-bar__center" aria-label="Sahha home">
            <SahhaWordmark size="header" />
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            className="app-bar__logout"
            aria-label="Sign out"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </header>

      <main className={`app-shell__main safe-x ${isLog ? 'app-shell__main--log' : ''}`}>
        <div className="app-container animate-fade-in">
          <Outlet />
        </div>
      </main>

      <nav className="dock" aria-label="Main">
        <div className="app-container">
          <div className="dock__inner">
            <NavLink
              to="/"
              end
              className={`dock__link ${isToday ? 'dock__link--active' : ''}`}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              Today
            </NavLink>

            <div className="dock__fab-wrap">
              <NavLink to="/log" aria-label="Log meal">
                <div className={`dock__fab ${isLog ? 'dock__fab--active' : ''}`}>
                  <svg className="dock__fab-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.25} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <span className={`dock__fab-label ${isLog ? 'dock__fab-label--active' : ''}`}>Log</span>
              </NavLink>
            </div>

            <NavLink
              to="/summary"
              className={`dock__link ${isStats ? 'dock__link--active' : ''}`}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
              Trends
            </NavLink>
          </div>
        </div>
      </nav>
    </div>
  );
};

export default MainLayout;
