import { useState, useCallback, useEffect, useMemo } from 'react';
import { Plus, Settings, Globe, Trash2, Cloud, Cog } from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTabStore } from '../../src/store/useTabStore';
import { getTheme } from '../../src/themes';
import type { Space } from '../../src/types';
import MainContent from './MainContent';
import ActiveTabsSidebar from './ActiveTabsSidebar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../src/components/ui/Dialog';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../src/components/ui/DropdownMenu';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';

function SortableSpaceItem({
  space,
  isActive,
  onSelect,
}: {
  space: Space;
  isActive: boolean;
  onSelect: () => void;
}) {
  const deleteSpace = useTabStore((state) => state.deleteSpace);
  const theme = useTabStore((state) => state.theme);
  const t = getTheme(theme);
  const [isHovered, setIsHovered] = useState(false);

  const sortableData = useMemo(() => ({ type: 'Space' as const, space }), [space]);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: space.id, data: sortableData });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        backgroundColor: isActive
          ? t.sidebarActiveBg
          : isHovered
            ? t.sidebarHoverBg
            : 'transparent',
      }}
      className={`group flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors ${
        isDragging ? 'opacity-50 shadow-md' : ''
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <button
        onClick={onSelect}
        className="flex-1 text-left truncate"
        style={{
          color: isActive ? t.sidebarActiveText : t.sidebarText,
          fontWeight: isActive ? 600 : 400,
          borderRadius: '0.375rem',
          padding: '0.25rem 0.5rem',
          margin: '-0.25rem -0.5rem',
        }}
      >
        {space.name}
      </button>
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ color: t.sidebarTextMuted }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
          <circle cx="2" cy="3" r="1.2" />
          <circle cx="6" cy="3" r="1.2" />
          <circle cx="10" cy="3" r="1.2" />
          <circle cx="2" cy="9" r="1.2" />
          <circle cx="6" cy="9" r="1.2" />
          <circle cx="10" cy="9" r="1.2" />
        </svg>
      </div>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button
            className="p-1 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ color: t.textMuted }}
            title="删除空间"
            onClick={(e) => e.stopPropagation()}
          >
            <Trash2 size={14} />
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确定要删除此空间吗？</AlertDialogTitle>
            <AlertDialogDescription>
              {space.groups.length > 0 ? (
                <span className="text-red-600 font-medium">
                  此空间内包含 {space.groups.length} 个标签组，删除后将永久丢失，确定要删除吗？
                </span>
              ) : (
                '此操作无法撤销，确定要删除此空间吗？'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteSpace(space.id)}>
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

const SPACE_POINTER_OPTIONS = { activationConstraint: { distance: 5 } as const };

function Sidebar() {
  const spaces = useTabStore((state) => state.spaces);
  const currentSpaceId = useTabStore((state) => state.currentSpaceId);
  const setCurrentSpace = useTabStore((state) => state.setCurrentSpace);
  const setCurrentView = useTabStore((state) => state.setCurrentView);
  const addSpace = useTabStore((state) => state.addSpace);
  const reorderSpaces = useTabStore((state) => state.reorderSpaces);
  const theme = useTabStore((state) => state.theme);
  const t = getTheme(theme);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState('');

  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null);

  const spaceSensors = useSensors(
    useSensor(PointerSensor, SPACE_POINTER_OPTIONS),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleCreateSpace = () => {
    const name = newSpaceName.trim();
    if (name) {
      addSpace(name);
      setNewSpaceName('');
      setDialogOpen(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreateSpace();
    }
  };

  const handleSpaceDragStart = useCallback((event: DragStartEvent) => {
    setActiveSpaceId(event.active.id as string);
  }, []);

  const handleSpaceDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveSpaceId(null);
      if (!over || active.id === over.id) return;
      reorderSpaces(active.id as string, over.id as string);
    },
    [reorderSpaces],
  );

  const activeSpace = spaces.find((s) => s.id === activeSpaceId);

  return (
    <aside
      className="w-64 h-screen flex flex-col border-r flex-shrink-0"
      style={{
        backgroundColor: t.sidebarBg,
        borderColor: t.sidebarBorder,
      }}
    >
      {/* 顶部：应用名称 + 添加按钮 */}
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-lg font-bold" style={{ color: t.sidebarText }}>FreeTab</span>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <button
              className="p-1.5 rounded-md transition-colors"
              style={{ color: t.sidebarTextMuted, ':hover': { color: t.sidebarText, backgroundColor: t.sidebarHoverBg } as any }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = t.sidebarText;
                e.currentTarget.style.backgroundColor = t.sidebarHoverBg;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = t.sidebarTextMuted;
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <Plus size={18} />
            </button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>创建新空间</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <label className="text-sm font-medium" style={{ color: t.textSecondary }}>
                  空间名称
                </label>
                <Input
                  value={newSpaceName}
                  onChange={(e) => setNewSpaceName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="输入空间名称"
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  取消
                </Button>
                <Button onClick={handleCreateSpace}>确定</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* 中间：Space 列表 */}
      <DndContext
        sensors={spaceSensors}
        onDragStart={handleSpaceDragStart}
        onDragEnd={handleSpaceDragEnd}
      >
        <SortableContext
          items={spaces.map((s) => s.id)}
          strategy={verticalListSortingStrategy}
        >
          <nav className="flex-1 px-3 py-2 space-y-0.5">
            {spaces.map((space) => (
              <SortableSpaceItem
                key={space.id}
                space={space}
                isActive={space.id === currentSpaceId}
                onSelect={() => {
                  setCurrentSpace(space.id);
                  setCurrentView('home');
                }}
              />
            ))}
          </nav>
        </SortableContext>
        <DragOverlay dropAnimation={null}>
          {activeSpace ? (
            <div
              className="px-3 py-2 rounded-md text-sm font-semibold shadow-lg"
              style={{
                backgroundColor: t.sidebarActiveBg,
                color: t.sidebarActiveText,
              }}
            >
              {activeSpace.name}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* 底部：设置按钮 */}
      <div className="px-3 py-3" style={{ borderColor: t.sidebarBorder, borderTopWidth: '1px', borderTopStyle: 'solid' }}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm transition-colors"
              style={{ color: t.sidebarTextMuted }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = t.sidebarHoverBg;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <Settings size={16} />
              <span>设置</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-48">
            <DropdownMenuItem
              onClick={() => {
                const setCurrentView = useTabStore.getState().setCurrentView;
                setCurrentView('settings');
              }}
              className="flex items-center gap-2 cursor-pointer"
            >
              <Cog size={14} style={{ color: t.textMuted }} />
              <span>设置</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                const setCurrentView = useTabStore.getState().setCurrentView;
                setCurrentView('sync');
              }}
              className="flex items-center gap-2 cursor-pointer"
            >
              <Cloud size={14} style={{ color: t.textMuted }} />
              <span>备份与同步</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}

interface DragItemData {
  type: 'ActiveTab' | 'Tab';
  tab: {
    id: number | string;
    title: string;
    url: string;
    favIconUrl?: string;
  };
  groupId?: string;
}

function DragOverlayCard({ item }: { item: DragItemData }) {
  const theme = useTabStore((state) => state.theme);
  const t = getTheme(theme);
  return (
    <div
      className="flex items-center gap-2 px-3 py-2.5 w-64 border rounded-md shadow-2xl opacity-90 cursor-grabbing"
      style={{
        backgroundColor: t.cardBg,
        borderColor: t.cardBorder,
      }}
    >
      {item.tab.favIconUrl ? (
        <img src={item.tab.favIconUrl} alt="" className="w-4 h-4 flex-shrink-0" />
      ) : (
        <Globe size={14} className="flex-shrink-0" style={{ color: t.textMuted }} />
      )}
      <span className="flex-1 min-w-0 text-sm truncate" style={{ color: t.textSecondary }}>
        {item.tab.title}
      </span>
    </div>
  );
}

function App() {
  const currentSpaceId = useTabStore((state) => state.currentSpaceId);
  const currentView = useTabStore((state) => state.currentView);
  const theme = useTabStore((state) => state.theme);
  const t = getTheme(theme);
  const moveTab = useTabStore((state) => state.moveTab);
  const addTabToGroup = useTabStore((state) => state.addTabToGroup);
  const saveCurrentWindowTabs = useTabStore(
    (state) => state.saveCurrentWindowTabs,
  );

  // 初始化 Storage 监听器，接收 Background 同步的数据
  useEffect(() => {
    const init = useTabStore.getState()._initStorageListener;
    if (init) init();
  }, []);

  const [activeDragItem, setActiveDragItem] = useState<DragItemData | null>(
    null,
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current as DragItemData | undefined;
    if (data) {
      setActiveDragItem(data);
    }
  }, []);

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over) return;

      const activeId = active.id as string;
      const overId = over.id as string;

      if (activeId === overId) return;

      const activeType = active.data.current?.type as string;
      const overType = over.data.current?.type as string;

      // 中间分组之间的拖拽 — 只在 onDragOver 做乐观更新
      if (activeType === 'Tab' && overType === 'Tab') {
        const activeGroupId = active.data.current?.groupId as string;
        const overGroupId = over.data.current?.groupId as string;
        if (!activeGroupId || !overGroupId) return;
        if (activeGroupId === overGroupId) return;

        moveTab(currentSpaceId, activeId, overId, overGroupId);
      }

      // 注意：右侧 ActiveTab 拖入中间不在 onDragOver 中处理，
      // 避免拖拽过程中反复创建/删除，只在 onDragEnd 中执行一次
    },
    [currentSpaceId, moveTab],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      // 严格拦截无效放置：没有拖到任何目标，或源和目标相同
      if (!over || active.id === over.id) {
        setActiveDragItem(null);
        return;
      }

      const activeId = active.id as string;
      const overId = over.id as string;

      const activeType = active.data.current?.type as string;
      const overType = over.data.current?.type as string;

      // 右侧活动标签页拖入中间分组
      if (activeType === 'ActiveTab') {
        const activeTab = active.data.current?.tab as {
          id: number;
          title: string;
          url: string;
          favIconUrl?: string;
        };
        if (!activeTab) {
          setActiveDragItem(null);
          return;
        }

        const newTab = {
          id: crypto.randomUUID(),
          title: activeTab.title,
          url: activeTab.url,
          favIconUrl: activeTab.favIconUrl,
        };

        let overGroupId: string | undefined;
        let insertIndex: number | undefined;

        if (overType === 'Tab') {
          // 情况 A：拖到了某个现有 TabItem 上
          overGroupId = over.data.current?.groupId as string;
          if (!overGroupId) {
            setActiveDragItem(null);
            return;
          }

          // 精确计算插入位置：找到 over 元素在目标分组中的索引
          const spaces = useTabStore.getState().spaces;
          const space = spaces.find((s) => s.id === currentSpaceId);
          const targetGroup = space?.groups.find((g) => g.id === overGroupId);
          const overIndex = targetGroup?.tabs.findIndex((t) => t.id === overId);

          if (overIndex !== undefined && overIndex >= 0) {
            insertIndex = overIndex;
          }
        } else if (overType === 'Group') {
          // 情况 B：拖到了 Group 的空白区域
          overGroupId = over.data.current?.groupId as string;
          if (!overGroupId) {
            setActiveDragItem(null);
            return;
          }
          // 不传入 insertIndex，追加到末尾
        } else {
          // 拖到未知类型，不处理
          setActiveDragItem(null);
          return;
        }

        addTabToGroup(currentSpaceId, overGroupId, newTab, insertIndex);
        chrome.tabs.remove(activeTab.id);
      }

      // 中间分组之间的拖拽
      if (activeType === 'Tab') {
        const activeGroupId = active.data.current?.groupId as string;
        if (!activeGroupId) {
          setActiveDragItem(null);
          return;
        }

        let overGroupId: string | undefined;
        let insertIndex: number | undefined;

        if (overType === 'Tab') {
          // 拖到了某个现有 TabItem 上
          overGroupId = over.data.current?.groupId as string;
          if (!overGroupId) {
            setActiveDragItem(null);
            return;
          }

          // 精确计算插入位置
          const spaces = useTabStore.getState().spaces;
          const space = spaces.find((s) => s.id === currentSpaceId);
          const targetGroup = space?.groups.find((g) => g.id === overGroupId);
          const overIndex = targetGroup?.tabs.findIndex((t) => t.id === overId);

          if (overIndex !== undefined && overIndex >= 0) {
            insertIndex = overIndex;
          }
        } else if (overType === 'Group') {
          // 拖到了 Group 的空白区域
          overGroupId = over.data.current?.groupId as string;
          if (!overGroupId) {
            setActiveDragItem(null);
            return;
          }
          // 不传入 insertIndex，追加到末尾
        } else {
          setActiveDragItem(null);
          return;
        }

        moveTab(currentSpaceId, activeId, overId, overGroupId);
      }

      // 重置拖拽状态
      setActiveDragItem(null);
    },
    [currentSpaceId, moveTab, addTabToGroup],
  );

  const handleDragCancel = useCallback(() => {
    setActiveDragItem(null);
  }, []);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="h-screen flex" style={{ backgroundColor: t.mainBg }}>
        <Sidebar />
        <MainContent />
        {currentView === 'home' && (
          <ActiveTabsSidebar onSaveAll={saveCurrentWindowTabs} />
        )}
      </div>
      <DragOverlay dropAnimation={null}>
        {activeDragItem ? <DragOverlayCard item={activeDragItem} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

export default App;
