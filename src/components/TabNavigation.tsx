import React, { useRef, useEffect } from 'react';

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
  className = '',
}) => {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const activeIndex = tabs.findIndex((tab) => tab.id === activeTab);
    const el = tabRefs.current[activeIndex];
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [activeTab, tabs]);

  return (
    <div className={`segment-tabs ${className}`} role="tablist">
      {tabs.map((tab, index) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
          ref={(el) => { tabRefs.current[index] = el; }}
          onClick={() => onTabChange(tab.id)}
          className={`segment-tabs__btn ${activeTab === tab.id ? 'segment-tabs__btn--active' : ''}`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
};

export default TabNavigation;
