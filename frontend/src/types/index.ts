export interface Link {
  id: number;
  title: string;
  url: string;
  description: string | null;
  tags: string[];
  isFavorite: boolean;
  isDead: boolean;
  sortOrder: number;
  cardId: number;
  folderId: number | null;
  createdBy: string | null;
  createdAt: string;
  lastCheckedAt?: string | null;
}

export interface Folder {
  id: number;
  title: string;
  description: string | null;
  sortOrder: number;
  cardId: number;
  links: Link[];
  createdBy: string | null;
  createdAt: string;
}

export interface Card {
  id: number;
  title: string;
  description: string | null;
  color: string;
  tags: string[];
  sortOrder: number;
  folders: Folder[];
  links: Link[];
  createdBy: string | null;
  createdAt: string;
}

export interface FavoriteLink extends Link {
  cardTitle: string;
  cardColor: string;
}

export interface CreateCardPayload {
  title: string;
  description?: string;
  color?: string;
  tags?: string[];
  createdBy?: string;
}

export interface CreateLinkPayload {
  title: string;
  url: string;
  description?: string;
  folderId?: number | null;
  tags?: string[];
  isFavorite?: boolean;
  createdBy?: string;
}

export interface CreateFolderPayload {
  title: string;
  description?: string;
  createdBy?: string;
}

export interface ReorderItem {
  type: 'link' | 'folder';
  id: number;
  sortOrder: number;
  folderId?: number | null;
}

export interface DeadLinkCheckResult {
  checked: number;
  dead: number;
  skipped?: number;
  unreachable?: number;
}

export interface CardOrderItem {
  id: number;
  sortOrder: number;
}
