import { expect, test } from '@playwright/test';

test('overview shows live demand and reaches a facility', async ({ page }) => {
  await page.goto('/overview');
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  await expect(page.getByTestId('kpi-demand')).toContainText('MW');
  await page.getByRole('link', { name: /Infrastructure/ }).click();
  await expect(page.getByRole('heading', { name: 'Infrastructure' })).toBeVisible();
  await page.getByTestId('facility-search').fill('Aurora');
  await page.getByTestId('facility-aurora').click();
  await expect(page.getByRole('heading', { name: 'Aurora Substation' })).toBeVisible();
});

test('an open incident can be acknowledged', async ({ page }) => {
  await page.goto('/incidents?id=INC-2418');
  const detail = page.getByRole('article');
  await expect(detail.getByRole('heading', { name: 'Tap changer hunting on TR-2' })).toBeVisible();
  await expect(detail.getByText('Open', { exact: true })).toBeVisible();
  await page.getByTestId('acknowledge').click();
  await expect(detail.getByText('Acknowledged', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start investigation' })).toBeVisible();
  await expect(page.getByTestId('acknowledge')).toHaveCount(0);
});
