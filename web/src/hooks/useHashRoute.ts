import { useCallback, useEffect, useState } from 'react';

/**
 * Hash-based routing: works on any static host with zero rewrite rules.
 * Route shape: `#/path/segments?key=value`.
 */
export interface HashRoute {
  /** Normalized path, always starting with "/". */
  path: string;
  /** Decoded path segments (empty for the root route). */
  segments: string[];
  /** Query parameters after "?" in the hash. */
  params: Record<string, string>;
}

export function parseHash(hash: string): HashRoute {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  const queryIndex = raw.indexOf('?');
  const pathPart = queryIndex === -1 ? raw : raw.slice(0, queryIndex);
  const queryPart = queryIndex === -1 ? '' : raw.slice(queryIndex + 1);

  const path = pathPart.startsWith('/') ? pathPart : `/${pathPart}`;
  const segments = path
    .split('/')
    .filter((segment) => segment !== '')
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    });

  const params: Record<string, string> = {};
  for (const [key, value] of new URLSearchParams(queryPart)) {
    params[key] = value;
  }
  return { path, segments, params };
}

/** Build a hash href, dropping empty/undefined params. */
export function buildHash(path: string, params?: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  if (params !== undefined) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') {
        search.set(key, value);
      }
    }
  }
  const query = search.toString();
  return `#${path}${query === '' ? '' : `?${query}`}`;
}

export function useHashRoute(): { route: HashRoute; navigate: (to: string) => void } {
  const [route, setRoute] = useState<HashRoute>(() => parseHash(window.location.hash));

  useEffect(() => {
    const onHashChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = useCallback((to: string) => {
    window.location.hash = to.startsWith('#') ? to.slice(1) : to;
  }, []);

  return { route, navigate };
}
