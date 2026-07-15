import { describe, expect, it } from 'vitest';
import { sanitizeErrorMessage } from './ErrorBoundary';

describe('sanitizeErrorMessage', () => {
  it('removes URLs and email addresses and caps the report', () => {
    const message = sanitizeErrorMessage(`Failed for person@example.com at https://example.test/private?token=secret ${'x'.repeat(600)}`);
    expect(message).not.toContain('person@example.com');
    expect(message).not.toContain('token=secret');
    expect(message).toContain('[email]');
    expect(message).toContain('[url]');
    expect(message.length).toBe(500);
  });
});
