import { describe, it, expect } from 'vitest';
import { signupPasswordError } from './authValidation';

describe('signupPasswordError', () => {
  it('returns null when both passwords match and are non-empty', () => {
    expect(signupPasswordError('hunter2pw', 'hunter2pw')).toBeNull();
  });
  it('flags an empty password', () => {
    expect(signupPasswordError('', '')).toBe('Enter a password.');
  });
  it('flags a mismatch', () => {
    expect(signupPasswordError('hunter2pw', 'hunter3pw')).toBe("Passwords don't match.");
  });
});
