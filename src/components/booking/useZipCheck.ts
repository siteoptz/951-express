'use client';

import { useEffect, useState } from 'react';
import type { Region } from '@/config/routes';

export type ZipCheck = {
  valid: boolean;
  served: boolean;
  region: Region | null;
  city: string | null;
  state: string | null;
  oppositeRegion: Region | null;
};
export type ZipStatus =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'done'; data: ZipCheck };

/** Calls /api/zip-check once the ZIP has 5 digits; cancels stale requests. */
export function useZipCheck(zip: string): ZipStatus {
  const [result, setResult] = useState<{ zip: string; value: ZipStatus } | null>(null);
  const ready = /^\d{5}$/.test(zip);

  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    fetch('/api/zip-check', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ zip }),
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        setResult({ zip, value: { status: 'done', data: (await res.json()) as ZipCheck } });
      })
      .catch((e) => {
        if (e?.name !== 'AbortError') setResult({ zip, value: { status: 'error' } });
      });
    return () => controller.abort();
  }, [zip, ready]);

  if (!ready) return { status: 'idle' };
  if (result?.zip === zip) return result.value;
  return { status: 'loading' };
}
