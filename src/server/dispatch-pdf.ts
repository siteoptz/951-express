import 'server-only';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { renderToBuffer } from '@react-pdf/renderer';
import { buildDispatchData, dispatchFileName } from '@/lib/dispatch-data';
import type { BookingForEmail, EmailContext } from '@/lib/email-data';
import { siteUrl } from '@/config/site';
import { company } from '@/config/company';
import { DispatchSheet } from '@/pdf/DispatchSheet';

export type DispatchPdf = { filename: string; content: Buffer };

/** The logo as a data URI (react-pdf reads PNG and JPG, not WebP). Missing logo: the sheet shows the company name. */
async function logoData(): Promise<string | undefined> {
  try {
    const file = path.join(process.cwd(), 'public', company.logo.email.path);
    return `data:image/png;base64,${(await readFile(file)).toString('base64')}`;
  } catch {
    return undefined;
  }
}

/** Renders the dispatch sheet for a completed booking. Throws if rendering fails; the caller decides what to do. */
export async function renderDispatchPdf(
  b: BookingForEmail,
  ctx: EmailContext,
  env: Record<string, string | undefined> = process.env,
): Promise<DispatchPdf> {
  const d = buildDispatchData(b, ctx, siteUrl(env));
  const content = await renderToBuffer(DispatchSheet({ d, logo: await logoData() }));
  return { filename: dispatchFileName(d.ref, b.vehicle), content };
}
