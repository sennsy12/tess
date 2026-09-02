import { useRef, useEffect, useState, ReactNode } from 'react';

export interface TabItem<T extends string = string> {
  id: T;
  label: string;
  icon?: ReactNode;
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

  const recalcIndicator = () => {
    const activeEl = tabRefs.current.get(activeTab);
    const container = containerRef.current;
    if (activeEl && container) {
      const containerRect = container.getBoundingClientRect();
      const activeRect = activeEl.getBoundingClientRect();
      setIndicator({
        left: activeRect.left - containerRect.left + container.scrollLeft,
        width: activeRect.width,
      });
    }
  };

  useEffect(recalcIndicator, [activeTab, tabs]);

  // Phase 0: recalc on resize / sidebar collapse (additive, no API change).
  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => recalcIndicator());
    observer.observe(container);
    window.addEventListener('resize', recalcIndicator);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', recalcIndicator);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Phase 0: arrow-key navigation between tabs (additive).
  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    let next: number | null = null;
    if (e.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    if (next !== null) {
      e.preventDefault();
      const nextTab = tabs[next];
      onChange(nextTab.id);
      tabRefs.current.get(nextTab.id)?.focus();
    }
  };

  // Phase 4: WAI tab wiring — each tab owns `${id}-panel`; TabContent
  // below renders the matching tabpanel, so no caller changes are needed
  // (callers already pass the tab id as tabKey by convention).
  const tabId = (id: string) => `${id}-tab`;
  const panelId = (id: string) => `${id}-panel`;

  if (variant === 'underline') {
    return (
      <div className="relative">
        <div
          ref={containerRef}
          className="flex flex-wrap gap-1 border-b border-dark-700 pb-px"
          role="tablist"
          aria-label="Faner"
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              ref={(el) => {
                if (el) tabRefs.current.set(tab.id, el);
              }}
              id={tabId(tab.id)}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={panelId(tab.id)}
              tabIndex={activeTab === tab.id ? 0 : -1}
              onClick={() => onChange(tab.id)}
              onKeyDown={(e) => handleKeyDown(e, tabs.findIndex((t) => t.id === tab.id))}
              className={`relative px-4 py-2.5 font-medium text-sm transition-colors duration-200 rounded-t-lg ${
                activeTab === tab.id
                  ? 'text-primary-400'
                  : 'text-dark-400 hover:text-dark-200 hover:bg-dark-800/40'
              }`}
            >
              {tab.icon && <span className="mr-2 inline-flex align-middle">{tab.icon}</span>}
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
    <div className="max-w-full overflow-x-auto">
    <div
      ref={containerRef}
      className="relative inline-flex gap-1 bg-dark-800/80 p-1 rounded-xl min-w-max"
      role="tablist"
      aria-label="Faner"
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
          id={tabId(tab.id)}
          role="tab"
          aria-selected={activeTab === tab.id}
          aria-controls={panelId(tab.id)}
          tabIndex={activeTab === tab.id ? 0 : -1}
          onClick={() => onChange(tab.id)}
          onKeyDown={(e) => handleKeyDown(e, tabs.findIndex((t) => t.id === tab.id))}
          className={`relative z-10 px-4 py-2 rounded-lg font-medium text-sm transition-colors duration-200 whitespace-nowrap ${
            activeTab === tab.id
              ? 'text-white'
              : 'text-dark-400 hover:text-dark-200'
          }`}
        >
          {tab.icon && <span className="mr-1.5 inline-flex align-middle">{tab.icon}</span>}
          {tab.label}
        </button>
      ))}
    </div>
    </div>
  );
}

/** Panel wrapper with slide-in animation; wired to its tab via matching ids */
export function TabContent({ tabKey, children }: { tabKey: string; children: ReactNode }) {
  return (
    <div
      key={tabKey}
      id={`${tabKey}-panel`}
      role="tabpanel"
      aria-labelledby={`${tabKey}-tab`}
      tabIndex={0}
      className="tab-content-enter"
    >
      {children}
    </div>
  );
}
