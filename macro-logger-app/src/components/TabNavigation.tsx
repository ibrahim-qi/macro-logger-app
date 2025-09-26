import React, { useState, useRef, useEffect } from 'react';

interface TabItem {
  id: string;
  label: string;
}

interface TabNavigationProps {
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
}

const TabNavigation: React.FC<TabNavigationProps> = ({
  tabs,
  activeTab,
  onTabChange,
  className = ''
}) => {
  const [underlineStyle, setUnderlineStyle] = useState({ width: 0, left: 0 });
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Update underline position when active tab changes
  useEffect(() => {
    const activeIndex = tabs.findIndex(tab => tab.id === activeTab);
    if (activeIndex !== -1 && tabRefs.current[activeIndex]) {
      const activeTabElement = tabRefs.current[activeIndex];
      if (activeTabElement) {
        const { offsetWidth, offsetLeft } = activeTabElement;
        setUnderlineStyle({
          width: offsetWidth,
          left: offsetLeft
        });
      }
    }
  }, [activeTab, tabs]);

  return (
    <div className={`relative ${className}`}>
      {/* Tab Buttons */}
      <div className="flex relative">
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            ref={(el) => (tabRefs.current[index] = el)}
            onClick={() => onTabChange(tab.id)}
            className={`
              flex-1 py-4 px-6 text-base font-medium transition-all duration-200 ease-out
              relative overflow-hidden active:scale-95
              ${
                activeTab === tab.id
                  ? 'text-slate-700'
                  : 'text-stone-500 hover:text-stone-700'
              }
            `}
          >
            {/* Ripple effect background */}
            <span className="absolute inset-0 bg-stone-100 opacity-0 hover:opacity-50 transition-opacity duration-200 rounded-lg"></span>
            
            {/* Tab label */}
            <span className="relative z-10">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Animated Underline */}
      <div
        className="absolute bottom-0 h-0.5 bg-slate-700 transition-all duration-300 ease-out rounded-full"
        style={{
          width: `${underlineStyle.width}px`,
          left: `${underlineStyle.left}px`,
          transform: 'translateZ(0)', // Hardware acceleration
          height: '2px', // Thicker underline for better visibility
        }}
      />

      {/* Base line */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-stone-200"></div>
    </div>
  );
};

export default TabNavigation;
