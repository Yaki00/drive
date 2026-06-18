import type {
  Card,
  CardOrderItem,
  CreateCardPayload,
  CreateFolderPayload,
  CreateLinkPayload,
  DeadLinkCheckResult,
  Folder,
  ReorderItem,
} from '../types';

const API_URL =
  import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? '/api' : '');

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      Array.isArray(error.message)
        ? error.message.join(', ')
        : error.message ?? 'Something went wrong',
    );
  }

  if (response.status === 204 || response.status === 205) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text.trim()) {
    return undefined as T;
  }

  return JSON.parse(text) as T;
}

export const api = {
  getCards: () => request<Card[]>('/cards'),

  createCard: (data: CreateCardPayload) =>
    request<Card>('/cards', { method: 'POST', body: JSON.stringify(data) }),

  updateCard: (id: number, data: Partial<CreateCardPayload>) =>
    request<Card>(`/cards/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteCard: (id: number) =>
    request<void>(`/cards/${id}`, { method: 'DELETE' }),

  addFolder: (cardId: number, data: CreateFolderPayload) =>
    request<Folder>(`/cards/${cardId}/folders`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateFolder: (folderId: number, data: Partial<CreateFolderPayload>) =>
    request<Folder>(`/cards/folders/${folderId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteFolder: (folderId: number) =>
    request<void>(`/cards/folders/${folderId}`, { method: 'DELETE' }),

  addLink: (cardId: number, data: CreateLinkPayload) =>
    request(`/cards/${cardId}/links`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  moveLink: (linkId: number, targetCardId: number, targetFolderId?: number | null) =>
    request(`/cards/links/${linkId}`, {
      method: 'PATCH',
      body: JSON.stringify({ cardId: targetCardId, folderId: targetFolderId ?? null }),
    }),

  updateLink: (
    linkId: number,
    data: Partial<CreateLinkPayload & { isFavorite?: boolean; isDead?: boolean; cardId?: number; folderId?: number | null }>,
  ) =>
    request(`/cards/links/${linkId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteLink: (linkId: number) =>
    request<void>(`/cards/links/${linkId}`, { method: 'DELETE' }),

  reorderCard: (cardId: number, items: ReorderItem[]) =>
    request<Card>(`/cards/${cardId}/reorder`, {
      method: 'POST',
      body: JSON.stringify({ items }),
    }),

  reorderCards: (items: CardOrderItem[]) =>
    request<Card[]>('/cards/reorder', {
      method: 'POST',
      body: JSON.stringify({ items }),
    }),

  checkDeadLinks: () =>
    request<DeadLinkCheckResult>('/cards/links/check-dead', { method: 'POST' }),
};
