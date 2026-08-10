import { test, expect } from '@playwright/test'

// One pass over the starter in a real browser: the counter through both the
// data-bind and hook text components, todo rows through the KoForeach render
// prop, two-way editing through a KoWith scope, and teardown through Remove.
test('the starter exercises the v2 surface without page errors', async ({ page }) => {
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(String(error)))

  await page.goto('/')

  const counterButton = page.getByRole('button', { name: /count is/ })
  await expect(counterButton).toContainText('0')
  const hookCounter = page.getByText('count via useKoValue:')
  await expect(hookCounter).toContainText('0')

  await counterButton.click()
  await expect(counterButton).toContainText('1')
  await expect(hookCounter).toContainText('1')

  await expect(page.getByText('Add your first todo.')).toBeVisible()
  await page.getByPlaceholder('Add item').fill('Write browser tests')
  await page.getByRole('button', { name: 'Add' }).click()
  await expect(page.getByText('Write browser tests')).toBeVisible()
  await expect(page.getByText('1 item (rendered by React)')).toBeVisible()
  await expect(page.getByText('Add your first todo.')).toBeHidden()

  await page.getByRole('checkbox').check()
  await expect(page.getByRole('checkbox')).toBeChecked()

  await page.getByRole('button', { name: 'Details' }).click()
  await expect(page.getByRole('heading', { name: 'Selected todo' })).toBeVisible()
  const detailsInput = page.locator('aside input')
  await detailsInput.fill('Renamed from details')
  await expect(page.getByText('Renamed from details')).toBeVisible()

  await page.getByRole('button', { name: 'Close' }).click()
  await expect(page.getByRole('heading', { name: 'Selected todo' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Remove' }).click()
  await expect(page.getByText('Add your first todo.')).toBeVisible()
  await expect(page.getByText('0 items (rendered by React)')).toBeVisible()

  expect(pageErrors).toEqual([])
})
