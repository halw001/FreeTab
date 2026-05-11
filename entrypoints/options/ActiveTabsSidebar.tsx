import { useState, useEffect, useCallback } from 'react';
import { Globe } from 'lucide-react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useTabStore } from '../../src/store/useTabStore';
import { getTheme } from '../../src/themes';
import { t } from '../../src/i18n';

interface ActiveTab {
  id: number;
  title: string;
  url: string;
  favIconUrl?: string;
}

function DraggableActiveTab({ tab }: { tab: ActiveTab }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `active-tab-${tab.id}`,
      data: { type: 'ActiveTab', tab },
    });

  const theme = useTabStore((state) => state.theme);
  const themeColors = getTheme(theme);

  const style = {
    transform: CSS.Transform.toString(transform),
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        backgroundColor: themeColors.cardBg,
        borderColor: themeColors.cardBorder,
        boxShadow: themeColors.cardShadow,
      }}
      {...attributes}
      {...listeners}
      className={`group flex items-center gap-2 px-3 py-2.5 border rounded-md hover:shadow transition-shadow cursor-pointer ${
        isDragging ? 'opacity-30 cursor-grabbing' : ''
      }`}
    >
      {tab.favIconUrl ? (
        <img
          src={tab.favIconUrl}
          alt=""
          className="w-4 h-4 flex-shrink-0"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : (
        <Globe size={14} className="flex-shrink-0" style={{ color: themeColors.textMuted }} />
      )}
      <span
        className="flex-1 min-w-0 text-sm truncate"
        style={{ color: themeColors.textSecondary }}
        title={tab.title}
      >
        {tab.title}
      </span>
    </div>
  );
}

interface ActiveTabsSidebarProps {
  onSaveAll: () => void;
}

export default function ActiveTabsSidebar({
  onSaveAll,
}: ActiveTabsSidebarProps) {
  const [activeTabs, setActiveTabs] = useState<ActiveTab[]>([]);
  const theme = useTabStore((state) => state.theme);
  const locale = useTabStore((state) => state.locale);
  const themeColors = getTheme(theme);

  const tr = (key: Parameters<typeof t>[1], params?: Record<string, string | number>) =>
    t(locale, key, params);

  const fetchTabs = useCallback(async () => {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const filtered = tabs.filter((tab) => {
      if (!tab.url) return false;
      if (tab.url.startsWith('chrome://')) return false;
      if (tab.url.startsWith('edge://')) return false;
      if (tab.url.startsWith('chrome-extension://')) return false;
      if (tab.url.startsWith('about:')) return false;
      return true;
    });
    setActiveTabs(
      filtered.map((tab) => ({
        id: tab.id!,
        title: tab.title || tr('unknown'),
        url: tab.url || '',
        favIconUrl: tab.favIconUrl,
      })),
    );
  }, []);

  useEffect(() => {
    fetchTabs();

    const handleCreated = () => fetchTabs();
    const handleUpdated = () => fetchTabs();
    const handleRemoved = () => fetchTabs();

    chrome.tabs.onCreated.addListener(handleCreated);
    chrome.tabs.onUpdated.addListener(handleUpdated);
    chrome.tabs.onRemoved.addListener(handleRemoved);

    return () => {
      chrome.tabs.onCreated.removeListener(handleCreated);
      chrome.tabs.onUpdated.removeListener(handleUpdated);
      chrome.tabs.onRemoved.removeListener(handleRemoved);
    };
  }, [fetchTabs]);

  return (
    <aside
      className="w-80 h-screen flex flex-col border-l flex-shrink-0"
      style={{
        backgroundColor: themeColors.mainBg,
        borderColor: themeColors.headerBorder,
      }}
    >
      {/* 顶部：标题 + 保存按钮 */}
      <div
        className="px-4 py-4 border-b"
        style={{
          backgroundColor: themeColors.headerBg,
          borderColor: themeColors.headerBorder,
        }}
      >
        <h2 className="text-sm font-bold mb-3" style={{ color: themeColors.textPrimary }}>
          {tr('currentTabs')}
        </h2>
        <button
          onClick={onSaveAll}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors"
          style={{
            backgroundColor: themeColors.buttonPrimaryBg,
            color: themeColors.buttonPrimaryText,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = themeColors.buttonPrimaryHover;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = themeColors.buttonPrimaryBg;
          }}
        >
          <span>📥</span>
          <span>{tr('saveAll')}</span>
        </button>
      </div>

      {/* 标签列表 */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {activeTabs.length === 0 ? (
          <p className="text-center text-sm py-8" style={{ color: themeColors.emptyText }}>
            {tr('noTabsToSave')}
          </p>
        ) : (
          activeTabs.map((tab) => <DraggableActiveTab key={tab.id} tab={tab} />)
        )}
      </div>
    </aside>
  );
}
