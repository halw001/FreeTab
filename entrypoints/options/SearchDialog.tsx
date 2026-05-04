import { useState, useMemo, useEffect, useRef } from 'react';
import { Search, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '../../src/components/ui/Dialog';
import { useTabStore } from '../../src/store/useTabStore';
import type { TabItem } from '../../src/types';

interface SearchResult {
  tab: TabItem;
  spaceId: string;
  spaceName: string;
  groupId: string;
  groupTitle: string;
}

interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function SearchDialog({ open, onOpenChange }: SearchDialogProps) {
  const spaces = useTabStore((state) => state.spaces);
  const deleteTab = useTabStore((state) => state.deleteTab);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const allTabs = useMemo(() => {
    const results: SearchResult[] = [];
    spaces.forEach((space) => {
      space.groups.forEach((group) => {
        group.tabs.forEach((tab) => {
          results.push({
            tab,
            spaceId: space.id,
            spaceName: space.name,
            groupId: group.id,
            groupTitle: group.title,
          });
        });
      });
    });
    return results;
  }, [spaces]);

  const filtered = useMemo(() => {
    if (!query.trim()) return allTabs;
    const q = query.toLowerCase();
    return allTabs.filter((item) => item.tab.title.toLowerCase().includes(q));
  }, [allTabs, query]);

  const handleOpenTab = (url: string) => {
    chrome.tabs.create({ url, active: false });
  };

  const handleDelete = (
    e: React.MouseEvent,
    spaceId: string,
    groupId: string,
    tabId: string,
  ) => {
    e.stopPropagation();
    deleteTab(spaceId, groupId, tabId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden">
        <DialogTitle className="sr-only">搜索标签页</DialogTitle>
        {/* 搜索输入框 */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
          <Search size={20} className="text-gray-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索所有标签页..."
            className="flex-1 bg-transparent outline-none text-base text-gray-900 placeholder:text-gray-400"
          />
        </div>

        {/* 结果列表 */}
        <div className="max-h-96 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <Search size={32} className="mb-3 opacity-50" />
              <p className="text-sm">
                {query.trim() ? '未找到匹配的标签页' : '输入关键词开始搜索'}
              </p>
            </div>
          ) : (
            <div className="py-2">
              {filtered.map((item) => (
                <div
                  key={item.tab.id}
                  className="group flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => handleOpenTab(item.tab.url)}
                >
                  {/* 图标 */}
                  <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center">
                    {item.tab.favIconUrl ? (
                      <img
                        src={item.tab.favIconUrl}
                        alt=""
                        className="w-5 h-5"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center">
                        <span className="text-xs text-gray-500">
                          {item.tab.title.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* 文字内容 */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {item.tab.title}
                    </p>
                    <p className="text-xs text-gray-400 truncate mt-0.5">
                      {item.spaceName} &gt; {item.groupTitle}
                    </p>
                  </div>

                  {/* 删除按钮 */}
                  <button
                    onClick={(e) =>
                      handleDelete(e, item.spaceId, item.groupId, item.tab.id)
                    }
                    className="p-1.5 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                    title="删除"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 底部统计 */}
        {filtered.length > 0 && (
          <div className="px-4 py-2 border-t border-gray-200 text-xs text-gray-400">
            共 {filtered.length} 个结果
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
