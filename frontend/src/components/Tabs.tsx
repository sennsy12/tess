import { useRef, useEffect, useState, ReactNode } from 'react';

export interface TabItem<T extends string = string> {
  id: T;
  label: string;
  icon?: string;
}

interface TabsProps<T extends string = string> {
  tabs: TabItem<T>[];
  activeTab: T;
  onChange: (tab: T) => void;
  variant?: 'pill' | 'underline';
}

export function Tabs<T extends string = string>({
  tabs,
  activeTab,
  onChange,
  variant = 'pill',
}: TabsProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  useEffect(() => {
    const activeEl = tabRefs.current.get(activeTab);
    const container = containerRef.current;
    if (activeEl && container) {
      const containerRect = container.getBoundingClientRect();
      const activeRect = activeEl.getBoundingClientRect();
      setIndicator({
        left: activeRect.left - containerRect.left,
        width: activeRect.width,
      });
    }
  }, [activeTab, tabs]);

  if (variant === 'underline') {
    return (
      <div className="relative">
        <div
          ref={containerRef}
          className="flex flex-wrap gap-1 border-b border-dark-700 pb-px"
          role="tablist"
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              ref={(el) => {
                if (el) tabRefs.current.set(tab.id, el);
              }}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => onChange(tab.id)}
              className={`relative px-4 py-2.5 font-medium text-sm transition-colors duration-200 rounded-t-lg ${
                activeTab === tab.id
                  ? 'text-primary-400'
                  : 'text-dark-400 hover:text-dark-200 hover:bg-dark-800/40'
              }`}
            >
              {tab.icon && <span className="mr-2">{tab.icon}</span>}
              {tab.label}
            </button>
          ))}
          {/* Animated underline indicator */}
          <div
            className="absolute bottom-0 h-0.5 bg-primary-500 rounded-full transition-all duration-300 ease-out"
            style={{ left: indicator.left, width: indicator.width }}
          />
        </div>
      </div>
    );
  }

  // Pill variant (default)
  return (
    <div
      ref={containerRef}
      className="relative inline-flex gap-1 bg-dark-800/80 p-1 rounded-xl"
      role="tablist"
    >
      {/* Animated pill background */}
      <div
        className="absolute top-1 h-[calc(100%-8px)] bg-primary-600 rounded-lg transition-all duration-300 ease-out shadow-lg shadow-primary-600/20"
        style={{ left: indicator.left, width: indicator.width }}
      />
      {tabs.map((tab) => (
        <button
          key={tab.id}
          ref={(el) => {
            if (el) tabRefs.current.set(tab.id, el);
          }}
          role="tab"
          aria-selected={activeTab === tab.id}
          onClick={() => onChange(tab.id)}
          className={`relative z-10 px-4 py-2 rounded-lg font-medium text-sm transition-colors duration-200 whitespace-nowrap ${
            activeTab === tab.id
              ? 'text-white'
              : 'text-dark-400 hover:text-dark-200'
          }`}
        >
          {tab.icon && <span className="mr-1.5">{tab.icon}</span>}
          {tab.label}
        </button>
      ))}
    </div>
  );
}

/** Wrapper that adds a slide-in animation when the active key changes */
export function TabContent({ tabKey, children }: { tabKey: string; children: ReactNode }) {
  return (
    <div key={tabKey} className="tab-content-enter">
      {children}
    </div>
  );
}
