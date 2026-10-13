// Reads the text and page count out of a PDF buffer, for tests.
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

export async function pdfText(buf: Buffer): Promise<{ pages: number; text: string }> {
  const doc = await getDocument({ data: new Uint8Array(buf), useSystemFonts: true }).promise;
  const parts: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    parts.push(content.items.map((it) => ('str' in it ? it.str : '')).join('\n'));
  }
  return { pages: doc.numPages, text: parts.join('\n') };
}
