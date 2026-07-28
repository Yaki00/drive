export type LinkEnvironment = 'PRD' | 'STG' | 'Not define';

export const LINK_ENVIRONMENTS: LinkEnvironment[] = ['PRD', 'STG', 'Not define'];

export const DEFAULT_LINK_ENVIRONMENT: LinkEnvironment = 'Not define';

export interface Link {
  id: number;
  title: string;
  url: string;
  description: string | null;
  tags: string[];
  environment: LinkEnvironment;
  /** UI overlay from per-user localStorage; API field is legacy/shared and ignored for favorites UI. */
  isFavorite: boolean;
  isDead: boolean;
  sortOrder: number;
  cardId: number;
  folderId: number | null;
  createdBy: string | null;
  createdAt: string;
  lastCheckedAt?: string | null;
  clickCount?: number;
  lastClickedAt?: string | null;
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
  environment: LinkEnvironment;
  /** Per-user UI preference; stored in localStorage, not relied on as shared API state. */
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

export type ActivityAction = 'create' | 'update' | 'delete';
export type ActivityEntityType = 'card' | 'folder' | 'link';

export interface ActivityEntry {
  id: number;
  at: string;
  actor: string;
  action: ActivityAction;
  entityType: ActivityEntityType;
  entityId: number;
  summary: string;
  before: unknown | null;
  after: unknown | null;
  reverted: boolean;
  revertedAt?: string | null;
  revertedBy?: string | null;
}

export interface LinkClickEvent {
  id: number;
  at: string;
  actor: string;
  linkId: number;
  title: string;
  url: string;
  cardId: number;
  cardTitle: string;
  folderId: number | null;
  environment: LinkEnvironment;
}

export interface KpiSnapshot {
  generatedAt: string;
  timeZone?: string;
  totals: {
    cards: number;
    folders: number;
    links: number;
    deadLinks: number;
    totalClicks: number;
    uniqueLinksClicked: number;
    clickEvents: number;
    activityEvents: number;
  };
  byEnvironment: Record<LinkEnvironment, number>;
  links: Array<{
    linkId: number;
    title: string;
    url: string;
    cardId: number;
    cardTitle: string;
    environment: LinkEnvironment;
    isDead: boolean;
    clicked: boolean;
    clickCount: number;
    lastClickedAt: string | null;
  }>;
  topLinks: Array<{
    linkId: number;
    title: string;
    url: string;
    cardId: number;
    cardTitle: string;
    environment: LinkEnvironment;
    isDead: boolean;
    clicks: number;
    lastClickedAt: string | null;
  }>;
  clicksByDay: Array<{ date: string; count: number }>;
  clicksByActor: Array<{ actor: string; count: number }>;
  clicksByCard: Array<{ cardId: number; cardTitle: string; count: number }>;
  activitySummary: { create: number; update: number; delete: number };
  recentClicks: LinkClickEvent[];
}

