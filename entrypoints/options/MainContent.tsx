import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Globe,
  MoreVertical,
  Trash2,
  ExternalLink,
  Pin,
  PinOff,
  Plus,
  Search,
  Cog,
} from 'lucide-react';
import SearchDialog from './SearchDialog';
import SyncView from './SyncView';
import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTabStore } from '../../src/store/useTabStore';
import type { TabGroup, TabItem } from '../../src/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../src/components/ui/Dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../src/components/ui/DropdownMenu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../../src/components/ui/AlertDialog';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';

function EditTabDialog({
  open,
  onOpenChange,
  tab,
  spaceId,
  groupId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tab: TabItem | null;
  spaceId: string;
  groupId: string;
}) {
  const updateTab = useTabStore((state) => state.updateTab);
  const [title, setTitle] = useState(tab?.title ?? '');
  const [url, setUrl] = useState(tab?.url ?? '');

  const handleSave = () => {
    if (!tab) return;
    updateTab(spaceId, groupId, tab.id, title.trim(), url.trim());
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>编辑标签</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">标题</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="输入标题"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">网址</label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="输入网址"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button onClick={handleSave}>保存</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SortableTabItemCard({
  tab,
  spaceId,
  groupId,
}: {
  tab: TabItem;
  spaceId: string;
  groupId: string;
}) {
  const deleteTab = useTabStore((state) => state.deleteTab);
  const [editOpen, setEditOpen] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tab.id, data: { type: 'Tab', tab, groupId } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className={`group w-64 h-12 flex items-center gap-2 px-3 bg-white border border-gray-200 rounded-md shadow-sm hover:shadow transition-shadow cursor-pointer ${
          isDragging ? 'opacity-50 shadow-lg ring-2 ring-blue-300 cursor-grabbing' : ''
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
          <Globe size={14} className="text-gray-400 flex-shrink-0" />
        )}
        <a
          href={tab.url}
          target="_blank"
          rel="noreferrer"
          className="flex-1 min-w-0 text-sm text-gray-700 truncate"
          title={tab.title}
        >
          {tab.title}
        </a>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity">
              <MoreVertical size={14} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setEditOpen(true)}>
              编辑
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => deleteTab(spaceId, groupId, tab.id)}
              className="text-red-600 focus:text-red-600"
            >
              删除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <EditTabDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        tab={tab}
        spaceId={spaceId}
        groupId={groupId}
      />
    </>
  );
}

function GroupSection({
  group,
  spaceId,
}: {
  group: TabGroup;
  spaceId: string;
}) {
  const deleteGroup = useTabStore((state) => state.deleteGroup);
  const togglePinGroup = useTabStore((state) => state.togglePinGroup);
  const updateGroupTitle = useTabStore((state) => state.updateGroupTitle);

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `group-${group.id}`,
    data: { type: 'Group', groupId: group.id },
  });

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(group.title);

  const handleOpenAll = () => {
    group.tabs.forEach((tab) => {
      chrome.tabs.create({ url: tab.url, active: false });
    });
  };

  const handleTitleSave = () => {
    updateGroupTitle(spaceId, group.id, tempTitle);
    setIsEditingTitle(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleTitleSave();
    }
  };

  return (
    <div className="mb-6">
      {/* 组头部 */}
      <div className="group/header flex items-center justify-between mb-3">
        {isEditingTitle ? (
          <input
            type="text"
            value={tempTitle}
            onChange={(e) => setTempTitle(e.target.value)}
            onBlur={handleTitleSave}
            onKeyDown={handleTitleKeyDown}
            autoFocus
            className="bg-transparent border-b-2 border-blue-500 outline-none text-sm font-bold text-gray-900 w-auto px-0 py-0.5"
          />
        ) : (
          <h3
            className="text-sm font-bold text-gray-900 cursor-pointer hover:text-blue-600 transition-colors"
            onClick={() => {
              setTempTitle(group.title);
              setIsEditingTitle(true);
            }}
            title="点击编辑标题"
          >
            {group.title}
          </h3>
        )}
        <div className="flex items-center gap-1 opacity-0 group-hover/header:opacity-100 transition-opacity">
          <button
            onClick={() => togglePinGroup(spaceId, group.id)}
            className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 hover:shadow-md transition-all rounded-md"
            title={group.pinned ? '取消置顶' : '置顶'}
          >
            {group.pinned ? (
              <PinOff className="w-5 h-5" />
            ) : (
              <Pin className="w-5 h-5" />
            )}
          </button>
          <button
            onClick={handleOpenAll}
            className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 hover:shadow-md transition-all rounded-md"
            title="打开全部"
          >
            <ExternalLink className="w-5 h-5" />
          </button>
          {group.tabs.length === 0 ? (
            <button
              onClick={() => deleteGroup(group.id)}
              className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 hover:shadow-md transition-all rounded-md"
              title="删除分组"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          ) : (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 hover:shadow-md transition-all rounded-md"
                  title="删除分组"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>确定要删除此分组吗？</AlertDialogTitle>
                  <AlertDialogDescription>
                    此操作无法撤销，分组内的所有标签页将被永久移除。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>取消</AlertDialogCancel>
                  <AlertDialogAction onClick={() => deleteGroup(group.id)}>
                    确认
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* 标签卡片流 */}
      <SortableContext items={group.tabs.map((t) => t.id)}>
        <div
          ref={setDroppableRef}
          className={`flex flex-wrap gap-3 min-h-[3rem] rounded-lg transition-colors ${
            isOver ? 'bg-gray-100/60' : ''
          }`}
        >
          {group.tabs.length === 0 ? (
            <div className="w-full h-24 border-2 border-dashed border-gray-200 rounded-md flex items-center justify-center text-gray-400 text-sm">
              拖动标签到此处
            </div>
          ) : (
            group.tabs.map((tab) => (
              <SortableTabItemCard
                key={tab.id}
                tab={tab}
                spaceId={spaceId}
                groupId={group.id}
              />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
}

export default function MainContent() {
  const spaces = useTabStore((state) => state.spaces);
  const currentSpaceId = useTabStore((state) => state.currentSpaceId);
  const currentView = useTabStore((state) => state.currentView);

  const currentSpace = spaces.find((s) => s.id === currentSpaceId);

  const sortedGroups = useMemo(() => {
    const groups = currentSpace?.groups ?? [];
    return [...groups].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return 0;
    });
  }, [currentSpace?.groups]);

  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(currentSpace?.name ?? '');
  const [searchOpen, setSearchOpen] = useState(false);

  const renameSpace = useTabStore((state) => state.renameSpace);
  const createEmptyGroup = useTabStore((state) => state.createEmptyGroup);
  const setCurrentView = useTabStore((state) => state.setCurrentView);

  const handleNameSave = () => {
    if (currentSpace) {
      renameSpace(currentSpace.id, tempName);
    }
    setIsEditingName(false);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleNameSave();
    }
  };

  const handleAddGroup = () => {
    if (currentSpace) {
      createEmptyGroup(currentSpace.id);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <main className="flex-1 flex flex-col min-w-0">
      {currentView === 'home' && (
        <header className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
        {isEditingName ? (
          <input
            type="text"
            value={tempName}
            onChange={(e) => setTempName(e.target.value)}
            onBlur={handleNameSave}
            onKeyDown={handleNameKeyDown}
            autoFocus
            className="bg-transparent border-b-2 border-blue-500 outline-none text-2xl font-bold text-gray-900 w-auto px-0 py-0.5"
          />
        ) : (
          <h1
            className="text-2xl font-bold text-gray-900 cursor-pointer hover:text-blue-600 transition-colors"
            onClick={() => {
              setTempName(currentSpace?.name ?? '');
              setIsEditingName(true);
            }}
            title="点击编辑空间名称"
          >
            {currentSpace?.name ?? 'Unknown'}
          </h1>
        )}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 hover:border-gray-300 transition-colors"
          >
            <Search size={16} />
            <span className="hidden sm:inline">搜索标签页</span>
          </button>
          <button
            onClick={handleAddGroup}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 hover:border-gray-300 transition-colors"
          >
            <Plus size={16} />
            <span>添加分组</span>
          </button>
        </div>
      </header>
      )}

      {currentView === 'home' && (
        <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
      )}

      {/* 内容区 */}
      <div className="flex-1 p-6 overflow-y-auto">
        {currentView === 'home' && (
          <>
            {sortedGroups.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <p className="text-gray-400 text-lg">
                  这里空空如也，从右侧拖拽标签页来收纳吧
                </p>
              </div>
            ) : (
              <div>
                {sortedGroups.map((group) => (
                  <GroupSection
                    key={group.id}
                    group={group}
                    spaceId={currentSpaceId}
                  />
                ))}
              </div>
            )}
          </>
        )}
        {currentView === 'sync' && <SyncView />}
        {currentView === 'settings' && (
          <div className="h-full flex flex-col items-center justify-center text-gray-400">
            <Cog size={48} className="mb-4 opacity-50" />
            <p className="text-lg">设置页面开发中</p>
            <button
              onClick={() => setCurrentView('home')}
              className="mt-4 px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
            >
              返回首页
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
