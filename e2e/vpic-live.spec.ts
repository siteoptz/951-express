import { expect, test } from '@playwright/test';

// Smoke test against the real NHTSA vPIC API, through our own endpoints. Excluded from `npm run e2e`;
// run it with `npm run e2e:live`. The main suite mocks these calls so it never depends on NHTSA.
test('vPIC makes and models work end to end @live', async ({ request }) => {
  const makes = await request.get('/api/vehicles/makes?year=2020');
  expect(makes.ok()).toBe(true);
  const labels = ((await makes.json()) as { makes: { label: string }[] }).makes.map((m) => m.label);
  expect(labels).toEqual(expect.arrayContaining(['Honda', 'Toyota', 'Ford']));

  const models = await request.get('/api/vehicles/models?year=2020&make=Honda');
  expect(models.ok()).toBe(true);
  const names = ((await models.json()) as { models: string[] }).models;
  expect(names).toEqual(expect.arrayContaining(['Civic', 'Accord'])); // cars
  expect(names).toEqual(expect.arrayContaining(['CR-V'])); // SUVs live under vPIC's "mpv" type

  const none = await request.get('/api/vehicles/models?year=2020&make=zzzz');
  expect(((await none.json()) as { models: string[] }).models).toEqual([]);
});
