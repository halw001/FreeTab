import { useState, useEffect, useCallback } from 'react';
import { Globe } from 'lucide-react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useTabStore } from '../../src/store/useTabStore';
import { getTheme } from '../../src/themes';

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
  const t = getTheme(theme);

  const style = {
    transform: CSS.Transform.toString(transform),
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        backgroundColor: t.cardBg,
        borderColor: t.cardBorder,
        boxShadow: t.cardShadow,
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
        <Globe size={14} className="flex-shrink-0" style={{ color: t.textMuted }} />
      )}
      <span
        className="flex-1 min-w-0 text-sm truncate"
        style={{ color: t.textSecondary }}
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
  const t = getTheme(theme);

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
        title: tab.title || 'Untitled',
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
        backgroundColor: t.mainBg,
        borderColor: t.headerBorder,
      }}
    >
      {/* 顶部：标题 + 保存按钮 */}
      <div
        className="px-4 py-4 border-b"
        style={{
          backgroundColor: t.headerBg,
          borderColor: t.headerBorder,
        }}
      >
        <h2 className="text-sm font-bold mb-3" style={{ color: t.textPrimary }}>
          当前打开的标签页
        </h2>
        <button
          onClick={onSaveAll}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors"
          style={{
            backgroundColor: t.buttonPrimaryBg,
            color: t.buttonPrimaryText,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = t.buttonPrimaryHover;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = t.buttonPrimaryBg;
          }}
        >
          <span>📥</span>
          <span>保存全部</span>
        </button>
      </div>

      {/* 标签列表 */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {activeTabs.length === 0 ? (
          <p className="text-center text-sm py-8" style={{ color: t.emptyText }}>
            没有可收纳的标签页
          </p>
        ) : (
          activeTabs.map((tab) => <DraggableActiveTab key={tab.id} tab={tab} />)
        )}
      </div>
    </aside>
  );
}
