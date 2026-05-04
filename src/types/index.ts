export interface TabItem {
  id: string;
  title: string;
  url: string;
  favIconUrl?: string;
}

export interface TabGroup {
  id: string;
  title: string;
  tabs: TabItem[];
  pinned?: boolean;
}

export interface Space {
  id: string;
  name: string;
  groups: TabGroup[];
}
