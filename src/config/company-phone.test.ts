import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { company } from '@/config/company';

// company.dispatchPhone is for the dispatch sheet PDF only (Cal approved it there and nowhere else). Pages, components,
// email templates and the public config must never read or contain it. The email bodies are also rendered in
// src/emails/emails.test.tsx.
const ROOT = join(process.cwd(), 'src');
const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)],
  );
const digits = company.dispatchPhone.replace(/\D/g, '');

describe('company.dispatchPhone stays on the dispatch sheet', () => {
  it('is a real phone number', () => {
    expect(digits).toHaveLength(10);
  });

  it.each(['app', 'components', 'emails'])(
    'is not in src/%s (pages, components, email templates)',
    (dir) => {
      for (const f of files(join(ROOT, dir)).filter(
        (p) =>
          /\.(tsx?|json|css|md)$/.test(p) &&
          !/\.test\.tsx?$/.test(p) &&
          !p.includes('__snapshots__'),
      )) {
        const src = readFileSync(f, 'utf8');
        expect(src, f).not.toContain('dispatchPhone');
        expect(src.replace(/\D/g, ''), f).not.toContain(digits);
      }
    },
  );

  it('is read only by the dispatch data (and defined in the company config)', () => {
    const users = files(ROOT)
      .filter((p) => /\.tsx?$/.test(p) && !/\.test\.tsx?$/.test(p))
      .filter((p) => readFileSync(p, 'utf8').includes('dispatchPhone'))
      .map((p) => p.slice(ROOT.length + 1));
    expect(users.sort()).toEqual(['config/company.ts', 'lib/dispatch-data.ts']);
  });
});
