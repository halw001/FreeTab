import { create } from 'zustand';
import type { Space, TabGroup, TabItem } from '../types';
import type { ThemeId } from '../themes';
import type { Locale } from '../i18n';
import { detectBrowserLocale } from '../i18n';

export type ViewType = 'home' | 'sync' | 'settings';

export interface SyncSettings {
  github: {
    enabled: boolean;
    token: string;
    autoSync: boolean;
    gistId?: string;
    lastSyncTime?: number;
  };
  webdav: {
    enabled: boolean;
    url: string;
    username: string;
    password: string;
    autoSync: boolean;
    lastSyncTime?: number;
  };
}

interface TabState {
  spaces: Space[];
  currentSpaceId: string;
  currentView: ViewType;
  theme: ThemeId;
  locale: Locale;
  lastModified: number;
  syncSettings: SyncSettings;
  addSpace: (name: string) => void;
  setCurrentSpace: (id: string) => void;
  setCurrentView: (view: ViewType) => void;
  setTheme: (theme: ThemeId) => void;
  setLocale: (locale: Locale) => void;
  renameSpace: (spaceId: string, newName: string) => void;
  deleteSpace: (spaceId: string) => void;
  reorderSpaces: (activeId: string, overId: string) => void;
  createEmptyGroup: (spaceId: string) => void;
  saveCurrentWindowTabs: () => Promise<void>;
  deleteGroup: (groupId: string) => void;
  deleteTab: (spaceId: string, groupId: string, tabId: string) => void;
  updateTab: (
    spaceId: string,
    groupId: string,
    tabId: string,
    newTitle: string,
    newUrl: string,
  ) => void;
  togglePinGroup: (spaceId: string, groupId: string) => void;
  updateGroupTitle: (spaceId: string, groupId: string, newTitle: string) => void;
  moveTab: (
    spaceId: string,
    activeId: string,
    overId: string,
    overGroupId: string,
  ) => void;
  addTabToGroup: (
    spaceId: string,
    groupId: string,
    tab: TabItem,
    insertIndex?: number,
  ) => void;
  importData: (data: Space[], lastModified?: number) => void;
  replaceSpaces: (newSpaces: Space[], lastModified?: number) => void;
  updateSyncSettings: (settings: Partial<SyncSettings>) => void;
  updateWebDavLastSyncTime: (time: number) => void;
  updateGistLastSyncTime: (time: number) => void;
  // 仅更新本地 lastModified，用于手动上传后将本地时间戳与远端对齐
  updateLastModified: (time: number) => void;
  _initStorageListener: () => void;
}

const STORAGE_KEY = 'freetab-store-v2';

// BUG 6: Debounce timer for chrome.storage.local writes
let saveTimer: ReturnType<typeof setTimeout> | null = null;

const defaultSyncSettings: SyncSettings = {
  github: { enabled: false, token: '', autoSync: false },
  webdav: { enabled: false, url: '', username: '', password: '', autoSync: false },
};

function loadState(): { spaces: Space[]; currentSpaceId: string; currentView: ViewType; theme: ThemeId; locale: Locale; lastModified: number; syncSettings: SyncSettings } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.state) {
      return {
        ...parsed.state,
        syncSettings: parsed.state.syncSettings ?? defaultSyncSettings,
      };
    }
    return null;
  } catch {
    return null;
  }
}

// BUG 6: Debounce chrome.storage.local writes to avoid frequent I/O during rapid operations (drag, type, etc.)
// localStorage stays immediate (synchronous, ensures data survives page unload)
function saveState(state: { spaces: Space[]; currentSpaceId: string; currentView: ViewType; theme: ThemeId; locale: Locale; lastModified: number; syncSettings: SyncSettings }) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ state }));
  } catch {
    // ignore
  }

  // chrome.storage.local: debounced (300ms) to batch rapid writes
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.set({ [STORAGE_KEY]: state }).catch(() => {
        // ignore
      });
    }
    saveTimer = null;
  }, 300);
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${h}:${min}`;
}

const defaultSpace: Space = {
  id: 'default',
  name: 'Default',
  groups: [],
};

const saved = loadState();

let isApplyingRemoteChange = false;

if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (isApplyingRemoteChange) return;

    if (namespace !== 'local') return;

    const storageChange = changes[STORAGE_KEY];
    if (!storageChange || !storageChange.newValue) return;

    const newState = storageChange.newValue;
    const newSpaces = newState.spaces;
    const newLastModified = newState.lastModified;

    const current = useTabStore.getState();
    const currentLastModified = current.lastModified;

    const newWebdavSyncTime = newState.syncSettings?.webdav?.lastSyncTime;
    const currentWebdavSyncTime = current.syncSettings?.webdav?.lastSyncTime;
    const newGistSyncTime = newState.syncSettings?.github?.lastSyncTime;
    const currentGistSyncTime = current.syncSettings?.github?.lastSyncTime;
    const syncSettingsChanged =
      (newWebdavSyncTime != null && newWebdavSyncTime !== currentWebdavSyncTime) ||
      (newGistSyncTime != null && newGistSyncTime !== currentGistSyncTime);

    const dataChanged = newLastModified > currentLastModified;

    if (dataChanged || syncSettingsChanged) {
      isApplyingRemoteChange = true;
      try {
        useTabStore.setState((state) => {
          const nextState = { ...state };

          if (dataChanged) {
            nextState.spaces = newSpaces;
            nextState.currentSpaceId = newSpaces[0]?.id ?? state.currentSpaceId;
            nextState.lastModified = newLastModified;
          }

          if (syncSettingsChanged) {
            nextState.syncSettings = newState.syncSettings ?? state.syncSettings;
          }

          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: nextState }));
          } catch {
            // ignore
          }
          return nextState;
        });
      } finally {
        // BUG 8: Reset flag via microtask instead of fixed 100ms timeout.
        // setState has completed synchronously (including localStorage write),
        // so it's safe to reset. Using microtask avoids the timing window where
        // a delayed chrome.storage.local.set could trigger onChanged after the flag is reset.
        queueMicrotask(() => {
          isApplyingRemoteChange = false;
        });
      }
    }
  });
}

export const useTabStore = create<TabState>((set) => ({
  spaces: saved?.spaces ?? [defaultSpace],
  currentSpaceId: saved?.currentSpaceId ?? defaultSpace.id,
  currentView: 'home',
  theme: saved?.theme ?? 'ocean',
  locale: saved?.locale ?? detectBrowserLocale(),
  lastModified: saved?.lastModified ?? 0,
  syncSettings: saved?.syncSettings ?? defaultSyncSettings,

  _initStorageListener: () => {
    // 监听器已在模块加载时注册
  },
  addSpace: (name: string) =>
    set((state) => {
      const newSpace: Space = {
        id: crypto.randomUUID(),
        name,
        groups: [],
      };
      const nextState = {
        ...state,
        spaces: [...state.spaces, newSpace],
        currentSpaceId: newSpace.id,
        lastModified: Date.now(),
      };
      saveState(nextState);
      return nextState;
    }),
  setCurrentSpace: (id: string) =>
    set((state) => {
      const nextState = { ...state, currentSpaceId: id };
      saveState(nextState);
      return nextState;
    }),
  setCurrentView: (view: ViewType) =>
    set((state) => {
      const nextState = { ...state, currentView: view };
      saveState(nextState);
      return nextState;
    }),
  setTheme: (theme: ThemeId) =>
    set((state) => {
      const nextState = { ...state, theme };
      saveState(nextState);
      return nextState;
    }),
  setLocale: (locale: Locale) =>
    set((state) => {
      const nextState = { ...state, locale };
      saveState(nextState);
      return nextState;
    }),
  saveCurrentWindowTabs: async () => {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const filteredTabs = tabs.filter((tab) => {
      if (!tab.url) return false;
      if (tab.url.startsWith('chrome://')) return false;
      if (tab.url.startsWith('edge://')) return false;
      if (tab.url.startsWith('chrome-extension://')) return false;
      if (tab.url.startsWith('about:')) return false;
      return true;
    });

    const tabItems: TabItem[] = filteredTabs.map((tab) => ({
      id: crypto.randomUUID(),
      title: tab.title || 'Untitled',
      url: tab.url || '',
      favIconUrl: tab.favIconUrl,
    }));

    if (tabItems.length === 0) return;

    const tabIds = filteredTabs.map((tab) => tab.id!).filter((id): id is number => id !== undefined);

    const newGroup: TabGroup = {
      id: crypto.randomUUID(),
      title: formatDate(new Date()),
      tabs: tabItems,
    };

    set((state) => {
      const nextSpaces = state.spaces.map((space) => {
        if (space.id === state.currentSpaceId) {
          return {
            ...space,
            groups: [newGroup, ...space.groups],
          };
        }
        return space;
      });
      const nextState = { ...state, spaces: nextSpaces, lastModified: Date.now() };
      saveState(nextState);
      return nextState;
    });

    if (tabIds.length > 0) {
      await chrome.tabs.remove(tabIds);
    }
  },
  deleteGroup: (groupId: string) =>
    set((state) => {
      const nextSpaces = state.spaces.map((space) => {
        if (space.id === state.currentSpaceId) {
          return {
            ...space,
            groups: space.groups.filter((g) => g.id !== groupId),
          };
        }
        return space;
      });
      const nextState = { ...state, spaces: nextSpaces, lastModified: Date.now() };
      saveState(nextState);
      return nextState;
    }),
  deleteTab: (spaceId: string, groupId: string, tabId: string) =>
    set((state) => {
      const nextSpaces = state.spaces.map((space) => {
        if (space.id !== spaceId) return space;
        return {
          ...space,
          groups: space.groups.map((group) => {
            if (group.id !== groupId) return group;
            return {
              ...group,
              tabs: group.tabs.filter((t) => t.id !== tabId),
            };
          }),
        };
      });
      const nextState = { ...state, spaces: nextSpaces, lastModified: Date.now() };
      saveState(nextState);
      return nextState;
    }),
  updateTab: (
    spaceId: string,
    groupId: string,
    tabId: string,
    newTitle: string,
    newUrl: string,
  ) =>
    set((state) => {
      const nextSpaces = state.spaces.map((space) => {
        if (space.id !== spaceId) return space;
        return {
          ...space,
          groups: space.groups.map((group) => {
            if (group.id !== groupId) return group;
            return {
              ...group,
              tabs: group.tabs.map((t) => {
                if (t.id !== tabId) return t;
                return { ...t, title: newTitle, url: newUrl };
              }),
            };
          }),
        };
      });
      const nextState = { ...state, spaces: nextSpaces, lastModified: Date.now() };
      saveState(nextState);
      return nextState;
    }),
  togglePinGroup: (spaceId: string, groupId: string) =>
    set((state) => {
      const nextSpaces = state.spaces.map((space) => {
        if (space.id !== spaceId) return space;
        return {
          ...space,
          groups: space.groups.map((group) => {
            if (group.id !== groupId) return group;
            return { ...group, pinned: !group.pinned };
          }),
        };
      });
      const nextState = { ...state, spaces: nextSpaces, lastModified: Date.now() };
      saveState(nextState);
      return nextState;
    }),
  updateGroupTitle: (spaceId: string, groupId: string, newTitle: string) =>
    set((state) => {
      const nextSpaces = state.spaces.map((space) => {
        if (space.id !== spaceId) return space;
        return {
          ...space,
          groups: space.groups.map((group) => {
            if (group.id !== groupId) return group;
            return { ...group, title: newTitle.trim() || group.title };
          }),
        };
      });
      const nextState = { ...state, spaces: nextSpaces, lastModified: Date.now() };
      saveState(nextState);
      return nextState;
    }),
  moveTab: (spaceId: string, activeId: string, overId: string, overGroupId: string) =>
    set((state) => {
      const space = state.spaces.find((s) => s.id === spaceId);
      if (!space) return state;

      let activeGroup = space.groups.find((g) => g.tabs.some((t) => t.id === activeId));
      let overGroup = space.groups.find((g) => g.id === overGroupId);
      if (!activeGroup || !overGroup) return state;

      const activeTab = activeGroup.tabs.find((t) => t.id === activeId);
      if (!activeTab) return state;

      const nextSpaces = state.spaces.map((s) => {
        if (s.id !== spaceId) return s;

        return {
          ...s,
          groups: s.groups.map((g) => {
            if (g.id === activeGroup!.id && g.id === overGroup!.id) {
              const oldIndex = g.tabs.findIndex((t) => t.id === activeId);
              const newIndex = g.tabs.findIndex((t) => t.id === overId);
              if (oldIndex === -1 || newIndex === -1) return g;
              const newTabs = [...g.tabs];
              const [moved] = newTabs.splice(oldIndex, 1);
              newTabs.splice(newIndex, 0, moved);
              return { ...g, tabs: newTabs };
            }
            if (g.id === activeGroup!.id) {
              return { ...g, tabs: g.tabs.filter((t) => t.id !== activeId) };
            }
            if (g.id === overGroup!.id) {
              const overIndex = g.tabs.findIndex((t) => t.id === overId);
              const newTabs = [...g.tabs];
              if (overIndex === -1) {
                newTabs.push(activeTab);
              } else {
                newTabs.splice(overIndex, 0, activeTab);
              }
              return { ...g, tabs: newTabs };
            }
            return g;
          }),
        };
      });

      const nextState = { ...state, spaces: nextSpaces, lastModified: Date.now() };
      saveState(nextState);
      return nextState;
    }),
  addTabToGroup: (
    spaceId: string,
    groupId: string,
    tab: TabItem,
    insertIndex?: number,
  ) =>
    set((state) => {
      const nextSpaces = state.spaces.map((space) => {
        if (space.id !== spaceId) return space;
        return {
          ...space,
          groups: space.groups.map((group) => {
            if (group.id !== groupId) return group;
            const newTabs = [...group.tabs];
            if (insertIndex !== undefined && insertIndex >= 0) {
              newTabs.splice(insertIndex, 0, tab);
            } else {
              newTabs.push(tab);
            }
            return { ...group, tabs: newTabs };
          }),
        };
      });
      const nextState = { ...state, spaces: nextSpaces, lastModified: Date.now() };
      saveState(nextState);
      return nextState;
    }),
  renameSpace: (spaceId: string, newName: string) =>
    set((state) => {
      const nextSpaces = state.spaces.map((space) => {
        if (space.id !== spaceId) return space;
        return { ...space, name: newName.trim() || space.name };
      });
      const nextState = { ...state, spaces: nextSpaces, lastModified: Date.now() };
      saveState(nextState);
      return nextState;
    }),
  deleteSpace: (spaceId: string) =>
    set((state) => {
      const nextSpaces = state.spaces.filter((s) => s.id !== spaceId);
      let nextCurrentId = state.currentSpaceId;
      if (state.currentSpaceId === spaceId) {
        nextCurrentId = nextSpaces[0]?.id ?? '';
      }
      const nextState = {
        ...state,
        spaces: nextSpaces,
        currentSpaceId: nextCurrentId,
        lastModified: Date.now(),
      };
      saveState(nextState);
      return nextState;
    }),
  reorderSpaces: (activeId: string, overId: string) =>
    set((state) => {
      const oldIndex = state.spaces.findIndex((s) => s.id === activeId);
      const newIndex = state.spaces.findIndex((s) => s.id === overId);
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
        return state;
      }
      const newSpaces = [...state.spaces];
      const [moved] = newSpaces.splice(oldIndex, 1);
      newSpaces.splice(newIndex, 0, moved);
      const nextState = { ...state, spaces: newSpaces, lastModified: Date.now() };
      saveState(nextState);
      return nextState;
    }),
  createEmptyGroup: (spaceId: string) =>
    set((state) => {
      const newGroup: TabGroup = {
        id: crypto.randomUUID(),
        title: formatDate(new Date()),
        tabs: [],
        pinned: false,
      };
      const nextSpaces = state.spaces.map((space) => {
        if (space.id !== spaceId) return space;
        const pinnedCount = space.groups.filter((g) => g.pinned).length;
        const newGroups = [...space.groups];
        newGroups.splice(pinnedCount, 0, newGroup);
        return { ...space, groups: newGroups };
      });
      const nextState = { ...state, spaces: nextSpaces, lastModified: Date.now() };
      saveState(nextState);
      return nextState;
    }),
  importData: (data: Space[], lastModified?: number) =>
    set((state) => {
      if (!window.confirm('警告：导入将覆盖当前所有数据，确定要继续吗？')) {
        return state;
      }
      const nextState = {
        ...state,
        spaces: data,
        currentSpaceId: data[0]?.id ?? state.currentSpaceId,
        lastModified: lastModified ?? Date.now(),
      };
      saveState(nextState);
      return nextState;
    }),
  replaceSpaces: (newSpaces: Space[], lastModified?: number) =>
    set((state) => {
      const nextState = {
        ...state,
        spaces: newSpaces,
        currentSpaceId: newSpaces[0]?.id ?? state.currentSpaceId,
        lastModified: lastModified ?? Date.now(),
      };
      saveState(nextState);
      return nextState;
    }),
  updateSyncSettings: (settings: Partial<SyncSettings>) =>
    set((state) => {
      const nextState = {
        ...state,
        syncSettings: {
          github: { ...state.syncSettings.github, ...(settings.github ?? {}) },
          webdav: { ...state.syncSettings.webdav, ...(settings.webdav ?? {}) },
        },
      };
      saveState(nextState);
      return nextState;
    }),
  updateWebDavLastSyncTime: (time: number) =>
    set((state) => {
      const nextState = {
        ...state,
        syncSettings: {
          ...state.syncSettings,
          webdav: { ...state.syncSettings.webdav, lastSyncTime: time },
        },
      };
      saveState(nextState);
      return nextState;
    }),
  updateGistLastSyncTime: (time: number) =>
    set((state) => {
      const nextState = {
        ...state,
        syncSettings: {
          ...state.syncSettings,
          github: { ...state.syncSettings.github, lastSyncTime: time },
        },
      };
      saveState(nextState);
      return nextState;
    }),
  updateLastModified: (time: number) =>
    set((state) => {
      const nextState = { ...state, lastModified: time };
      saveState(nextState);
      return nextState;
    }),
}));

if (typeof chrome !== 'undefined' && chrome.storage?.local) {
  (async () => {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      const remoteData = result[STORAGE_KEY];
      if (!remoteData) return;

      const current = useTabStore.getState();
      const currentSpaces = current.spaces;
      const currentLastModified = current.lastModified;

      const isCurrentEmpty = currentSpaces.reduce(
        (sum, s) => sum + s.groups.reduce((gSum, g) => gSum + g.tabs.length, 0),
        0,
      ) === 0;

      const newWebdavSyncTime = remoteData.syncSettings?.webdav?.lastSyncTime;
      const currentWebdavSyncTime = current.syncSettings?.webdav?.lastSyncTime;
      const newGistSyncTime = remoteData.syncSettings?.github?.lastSyncTime;
      const currentGistSyncTime = current.syncSettings?.github?.lastSyncTime;
      const syncSettingsChanged =
        (newWebdavSyncTime != null && newWebdavSyncTime !== currentWebdavSyncTime) ||
        (newGistSyncTime != null && newGistSyncTime !== currentGistSyncTime);

      // BUG 10: Re-check local state before applying remote change,
      // in case user modified data during the async gap between loadState() and here
      const latestLocal = useTabStore.getState();
      if (latestLocal.lastModified > currentLastModified && !isCurrentEmpty) {
        // Local data was modified during cold start, skip remote override
        return;
      }

      const dataChanged = remoteData.lastModified > currentLastModified || isCurrentEmpty;

      if (dataChanged || syncSettingsChanged) {
        isApplyingRemoteChange = true;
        try {
          useTabStore.setState((state) => {
            const nextState = { ...state };

            if (dataChanged) {
              nextState.spaces = remoteData.spaces;
              nextState.currentSpaceId = remoteData.spaces[0]?.id ?? state.currentSpaceId;
              nextState.lastModified = remoteData.lastModified;
            }

            if (syncSettingsChanged) {
              nextState.syncSettings = remoteData.syncSettings ?? state.syncSettings;
            }

            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: nextState }));
            } catch {
              // ignore
            }
            return nextState;
          });
        } finally {
          // BUG 8: Reset via microtask instead of fixed timeout
          queueMicrotask(() => {
            isApplyingRemoteChange = false;
          });
        }
      }
    } catch (error) {
      console.error('冷启动同步失败:', error);
    }
  })();
}
