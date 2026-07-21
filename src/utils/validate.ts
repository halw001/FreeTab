import type { Space, TabGroup, TabItem } from '../types';

/**
 * 校验 tab 对象结构是否合法
 */
function isValidTab(tab: unknown): tab is TabItem {
  if (!tab || typeof tab !== 'object') return false;
  const t = tab as Record<string, unknown>;
  return (
    typeof t.id === 'string' &&
    typeof t.title === 'string' &&
    typeof t.url === 'string'
  );
}

/**
 * 校验 group 对象结构是否合法
 */
function isValidGroup(group: unknown): group is TabGroup {
  if (!group || typeof group !== 'object') return false;
  const g = group as Record<string, unknown>;
  if (typeof g.id !== 'string' || typeof g.title !== 'string') return false;
  if (!Array.isArray(g.tabs)) return false;
  return g.tabs.every(isValidTab);
}

/**
 * 校验 space 对象结构是否合法
 */
function isValidSpace(space: unknown): space is Space {
  if (!space || typeof space !== 'object') return false;
  const s = space as Record<string, unknown>;
  if (typeof s.id !== 'string' || typeof s.name !== 'string') return false;
  if (!Array.isArray(s.groups)) return false;
  return s.groups.every(isValidGroup);
}

export interface SanitizeResult {
  spaces: Space[];
  /** 被过滤掉的无效条目数 */
  dropped: number;
  /** 原始数据是否合法（无任何丢弃） */
  valid: boolean;
}

/**
 * 对远端返回的数据进行结构校验与清洗。
 * 兼容旧格式（纯数组）和新格式（{ spaces, lastModified }）。
 * 只保留结构合法的 space，丢弃损坏条目。
 */
export function sanitizeRemoteData(raw: unknown): SanitizeResult {
  let arr: unknown[];

  if (Array.isArray(raw)) {
    arr = raw;
  } else if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.spaces)) {
      arr = obj.spaces;
    } else {
      return { spaces: [], dropped: 0, valid: false };
    }
  } else {
    return { spaces: [], dropped: 0, valid: false };
  }

  const spaces: Space[] = [];
  let dropped = 0;

  for (const item of arr) {
    if (isValidSpace(item)) {
      spaces.push(item);
    } else {
      dropped++;
    }
  }

  return { spaces, dropped, valid: dropped === 0 };
}
