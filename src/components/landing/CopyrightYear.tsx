// Cache Components forbids reading the current time during prerender, so cache it explicitly.
export async function CopyrightYear() {
  'use cache';
  return <>{new Date().getFullYear()}</>;
}
