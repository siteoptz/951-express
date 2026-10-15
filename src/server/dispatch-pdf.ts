import 'server-only';
import { renderToBuffer } from '@react-pdf/renderer';
import { buildDispatchData, dispatchFileName } from '@/lib/dispatch-data';
import type { BookingForEmail, EmailContext } from '@/lib/email-data';
import { siteUrl } from '@/config/site';
import { DispatchSheet } from '@/pdf/DispatchSheet';

export type DispatchPdf = { filename: string; content: Buffer };

/** Renders the dispatch sheet for a completed booking. Throws if rendering fails; the caller decides what to do. */
export async function renderDispatchPdf(
  b: BookingForEmail,
  ctx: EmailContext,
  env: Record<string, string | undefined> = process.env,
): Promise<DispatchPdf> {
  const d = buildDispatchData(b, ctx, siteUrl(env));
  const content = await renderToBuffer(DispatchSheet({ d }));
  return { filename: dispatchFileName(d.ref, b.vehicle), content };
}
