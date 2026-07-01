const WATCHLIST_KEY = 'yuanqi_watchlist';

export interface WatchlistItem {
  code: string;
  name: string;
  addedAt: string;
}

export function getWatchlist(): WatchlistItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(WATCHLIST_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function addToWatchlist(code: string, name: string): boolean {
  const list = getWatchlist();
  if (list.some((item) => item.code === code)) return false;
  list.push({ code, name, addedAt: new Date().toISOString() });
  localStorage.setItem(WATCHLIST_KEY, JSON.stringify(list));
  return true;
}

export function removeFromWatchlist(code: string): void {
  const list = getWatchlist().filter((item) => item.code !== code);
  localStorage.setItem(WATCHLIST_KEY, JSON.stringify(list));
}

export function isInWatchlist(code: string): boolean {
  return getWatchlist().some((item) => item.code === code);
}
