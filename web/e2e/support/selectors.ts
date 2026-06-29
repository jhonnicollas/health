import { Page, expect } from '@playwright/test';

export async function expectAnyVisible(page: Page, patterns: Array<string | RegExp>, timeoutMs = 8000) {
  // Race ALL patterns simultaneously within a single shared timeout.
  // Promise.any() returns on first match; fails after timeoutMs if none match.
  // This is O(timeoutMs) instead of O(patterns × timeoutMs) in the sequential approach.
  const locators = patterns.map((p) =>
    (typeof p === 'string'
      ? page.getByText(p, { exact: false })
      : page.getByText(p)
    ).first()
  );

  try {
    await Promise.any(
      locators.map((l) => l.waitFor({ state: 'visible', timeout: timeoutMs }))
    );
  } catch (e) {
    const details = (e as AggregateError)?.errors
      ?.map((err: Error) => `  ${err.message?.slice(0, 120)}`)
      ?.join('\n') || '(no details)';
    throw new Error(
      `None of these text patterns were visible after ${timeoutMs}ms:\n${patterns.map(String).join(', ')}\n\nDetails:\n${details}`,
      { cause: e }
    );
  }
}

export async function expectNoSecretLikeText(page: Page) {
  const text = await page.locator('body').innerText();

  expect(text).not.toMatch(/sk-[A-Za-z0-9_-]{20,}/);
  expect(text).not.toMatch(/cf_[A-Za-z0-9_-]{20,}/i);
  expect(text).not.toMatch(/\d{8,10}:[A-Za-z0-9_-]{30,}/);
  expect(text).not.toMatch(/-----BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY-----/);
}
