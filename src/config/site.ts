type Env = Record<string, string | undefined>;

/**
 * The public address of the site, for links that must be absolute (emails, Open Graph). NEXT_PUBLIC_SITE_URL wins
 * (set it to the real domain at launch); on Vercel the production URL is the fallback; locally it is localhost.
 */
export function siteUrl(env: Env = process.env): string {
  const set = env.NEXT_PUBLIC_SITE_URL?.trim();
  if (set) return set.replace(/\/$/, '');
  if (env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return 'http://localhost:3000';
}
