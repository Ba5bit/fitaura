import { describe, it, expect, vi, beforeEach } from 'vitest';

const { signUp, signInWithPassword, signOut } = vi.hoisted(() => ({
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: { auth: { signUp, signInWithPassword, signOut } },
}));

import { authSignUp, authSignIn, authSignOut } from './authService';

beforeEach(() => {
  signUp.mockReset();
  signInWithPassword.mockReset();
  signOut.mockReset();
});

describe('authSignUp', () => {
  it('returns ok with the user on success', async () => {
    signUp.mockResolvedValue({ data: { user: { id: 'u1', email: 'a@b.com' } }, error: null });
    const res = await authSignUp('a@b.com', 'password123');
    expect(res).toEqual({ ok: true, user: { id: 'u1', email: 'a@b.com' } });
  });

  it('maps "User already registered" to a friendly message', async () => {
    signUp.mockResolvedValue({ data: { user: null }, error: { message: 'User already registered' } });
    const res = await authSignUp('a@b.com', 'password123');
    expect(res).toEqual({ ok: false, error: 'That email already has an account — try logging in.' });
  });
});

describe('authSignIn', () => {
  it('maps "Invalid login credentials" to a friendly message', async () => {
    signInWithPassword.mockResolvedValue({ data: { user: null }, error: { message: 'Invalid login credentials' } });
    const res = await authSignIn('a@b.com', 'nope');
    expect(res).toEqual({ ok: false, error: 'Wrong email or password.' });
  });

  it('returns ok with the user on success', async () => {
    signInWithPassword.mockResolvedValue({ data: { user: { id: 'u1', email: 'a@b.com' } }, error: null });
    const res = await authSignIn('a@b.com', 'password123');
    expect(res).toEqual({ ok: true, user: { id: 'u1', email: 'a@b.com' } });
  });
});

describe('authSignOut', () => {
  it('calls supabase signOut', async () => {
    signOut.mockResolvedValue({ error: null });
    await authSignOut();
    expect(signOut).toHaveBeenCalledOnce();
  });
});
