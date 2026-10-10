import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { company, contactMailto } from '@/config/company';
import { siteUrl } from '@/config/site';

const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
const sources = files('src').filter(
  (f) => /\.(ts|tsx|css)$/.test(f) && !f.endsWith('company.test.ts'),
);

describe('company facts', () => {
  it('has the confirmed numbers and insurance wording, and one way to reach us', () => {
    expect(company).toMatchObject({
      usdot: '4020917',
      mc: 'MC-1516594',
      insurance: 'Fully licensed and bonded with a cargo limit of $250,000 per occurrence',
      contactEmail: '951.dispatcher@gmail.com',
    });
    expect(contactMailto).toBe('mailto:951.dispatcher@gmail.com');
    expect(company.confirmedStats).toEqual([]);
  });
});

describe('what was removed stays removed', () => {
  it('has no phone number and no tel: link anywhere in the source', () => {
    const hits = sources.filter((f) => /427-9763|4279763|\btel:/.test(readFileSync(f, 'utf8')));
    expect(hits).toEqual([]);
  });
  it('has no phone fields on the company', () => {
    expect(Object.keys(company)).not.toContain('phone');
    expect(Object.keys(company)).not.toContain('phoneHref');
  });
  it('has no $750K figure, crash claim, or years-in-operation claim', () => {
    const hits = sources.filter((f) =>
      /750K|\$750|crashes in 24|yearsInOperation|insuranceCoverage/i.test(readFileSync(f, 'utf8')),
    );
    expect(hits).toEqual([]);
  });
  it('has no credentials and partners section', () => {
    expect(
      sources.filter((f) =>
        /TrustLogos|trustLogos|Credentials & partners/.test(readFileSync(f, 'utf8')),
      ),
    ).toEqual([]);
  });
});

describe('siteUrl', () => {
  it('prefers NEXT_PUBLIC_SITE_URL, then the Vercel production URL, then localhost', () => {
    expect(
      siteUrl({
        NEXT_PUBLIC_SITE_URL: 'https://951express.com/',
        VERCEL_PROJECT_PRODUCTION_URL: 'x.vercel.app',
      }),
    ).toBe('https://951express.com');
    expect(siteUrl({ VERCEL_PROJECT_PRODUCTION_URL: '951-express.vercel.app' })).toBe(
      'https://951-express.vercel.app',
    );
    expect(siteUrl({})).toBe('http://localhost:3000');
  });
});
