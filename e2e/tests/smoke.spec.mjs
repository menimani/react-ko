import { test, expect } from '@playwright/test'

// One pass over the Bookshelf starter in a real browser: app and row binding
// roots, two-way form values, observableArray rendering, computed summary,
// filtering, editing, and localStorage persistence.
test('the starter bookshelf works without page errors', async ({ page }) => {
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(String(error)))

  await page.goto('/')

  const summary = page.getByRole('region', { name: 'Reading summary' })
  await expect(page.getByRole('heading', { name: 'My Bookshelf' })).toBeVisible()
  await expect(summary.getByText('3', { exact: true })).toHaveCount(1)

  await page.getByPlaceholder('Book title').fill('The Dispossessed')
  await page.getByPlaceholder('Author name').fill('Ursula K. Le Guin')
  await page.getByLabel('Status', { exact: true }).selectOption('reading')
  await page.getByLabel('Rating', { exact: true }).selectOption('5')
  await page.getByRole('button', { name: 'Add to shelf' }).click()

  const addedBook = page.locator('.book-card').filter({ hasText: 'The Dispossessed' })
  await expect(addedBook).toContainText('Ursula K. Le Guin')
  await expect(summary.getByText('4', { exact: true })).toHaveCount(1)
  await expect(summary.getByText('2', { exact: true })).toHaveCount(1)
  await expect(summary.getByText('4.3', { exact: true })).toBeVisible()

  await page.getByLabel('Filter by status').selectOption('reading')
  await expect(page.locator('.book-card')).toHaveCount(2)
  await expect(addedBook).toBeVisible()

  await addedBook.getByRole('button', { name: 'Edit' }).click()
  await expect(page.getByRole('heading', { name: 'Edit book' })).toBeVisible()
  await page.getByPlaceholder('Book title').fill('The Dispossessed (edited)')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('The Dispossessed (edited)')).toBeVisible()

  await page.reload()
  await page.getByLabel('Filter by status').selectOption('all')
  await expect(page.getByText('The Dispossessed (edited)')).toBeVisible()
  await expect(summary.getByText('4', { exact: true })).toHaveCount(1)

  expect(pageErrors).toEqual([])
})
