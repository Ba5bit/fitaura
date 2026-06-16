import { describe, it, expect, vi, beforeEach } from 'vitest';

const { signUp, signInWithPassword, signOut, resend, resetPasswordForEmail, verifyOtp, updateUser } =
  vi.hoisted(() => ({
    signUp: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    resend: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    verifyOtp: vi.fn(),
    updateUser: vi.fn(),
  }));

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { signUp, signInWithPassword, signOut, resend, resetPasswordForEmail, verifyOtp, updateUser },
  },
}));

import {
  authSignUp, authSignIn, authSignOut, authResend, authResetPassword, authVerifyOtp, authUpdatePassword,
} from './authService';

beforeEach(() => {
  [signUp, signInWithPassword, signOut, resend, resetPasswordForEmail, verifyOtp, updateUser].forEach((m) => m.mockReset());
});

describe('authSignUp', () => {
  it('returns status "confirm" when no session is created (email confirmation on)', async () => {
    signUp.mockResolvedValue({
      data: { user: { id: 'u1', email: 'a@b.com', identities: [{ id: 'i1' }] }, session: null },
      error: null,
    });
    const res = await authSignUp('a@b.com', 'password123');
    expect(res).toEqual({ ok: true, status: 'confirm', user: { id: 'u1', email: 'a@b.com' } });
    expect(signUp).toHaveBeenCalledWith({ email: 'a@b.com', password: 'password123' });
  });

  it('treats an empty identities array as already-registered', async () => {
    signUp.mockResolvedValue({
      data: { user: { id: 'u1', email: 'a@b.com', identities: [] }, session: null },
      error: null,
    });
    const res = await authSignUp('a@b.com', 'password123');
    expect(res).toEqual({ ok: false, error: 'That email already has an account — try logging in.' });
  });

  it('maps an error to a friendly message', async () => {
    signUp.mockResolvedValue({ data: { user: null, session: null }, error: { message: 'User already registered' } });
    const res = await authSignUp('a@b.com', 'password123');
    expect(res).toEqual({ ok: false, error: 'That email already has an account — try logging in.' });
  });
});

describe('authSignIn', () => {
  it('flags an unconfirmed email', async () => {
    signInWithPassword.mockResolvedValue({ data: { user: null }, error: { message: 'Email not confirmed' } });
    const res = await authSignIn('a@b.com', 'password123');
    expect(res).toEqual({
      ok: false,
      needsConfirm: true,
      error: 'Please confirm your email first — check your inbox (and spam).',
    });
  });

  it('returns ok with the user on success', async () => {
    signInWithPassword.mockResolvedValue({ data: { user: { id: 'u1', email: 'a@b.com' } }, error: null });
    const res = await authSignIn('a@b.com', 'password123');
    expect(res).toEqual({ ok: true, user: { id: 'u1', email: 'a@b.com' } });
  });
});

describe('authResend / authResetPassword / authVerifyOtp / authUpdatePassword', () => {
  it('authResend resends the signup confirmation', async () => {
    resend.mockResolvedValue({ error: null });
    expect(await authResend('a@b.com')).toEqual({ ok: true });
    expect(resend).toHaveBeenCalledWith({ type: 'signup', email: 'a@b.com' });
  });
  it('authResetPassword triggers a recovery email', async () => {
    resetPasswordForEmail.mockResolvedValue({ error: null });
    expect(await authResetPassword('a@b.com')).toEqual({ ok: true });
    expect(resetPasswordForEmail).toHaveBeenCalledWith('a@b.com');
  });
  it('authVerifyOtp returns ok:false with a friendly message on error', async () => {
    verifyOtp.mockResolvedValue({ error: { message: 'Token has expired or is invalid' } });
    expect(await authVerifyOtp('abc', 'email')).toEqual({
      ok: false,
      error: 'This link is invalid or has expired.',
    });
  });
  it('authUpdatePassword updates the password', async () => {
    updateUser.mockResolvedValue({ error: null });
    expect(await authUpdatePassword('newpassword1')).toEqual({ ok: true });
    expect(updateUser).toHaveBeenCalledWith({ password: 'newpassword1' });
  });
  it('authUpdatePassword maps a same-as-current-password error to a clear message', async () => {
    updateUser.mockResolvedValue({ error: { message: 'New password should be different from the old password.' } });
    expect(await authUpdatePassword('samepass1')).toEqual({
      ok: false,
      error: 'Your new password must be different from your current one.',
    });
  });
  it('authUpdatePassword maps a weak/breached-password error to a clear message', async () => {
    updateUser.mockResolvedValue({ error: { message: 'Password is known to be weak and easy to guess, please choose a different one.' } });
    expect(await authUpdatePassword('123456')).toEqual({
      ok: false,
      error: 'That password is too weak or has appeared in a data breach — pick another.',
    });
  });
});

describe('authSignOut', () => {
  it('calls supabase signOut', async () => {
    signOut.mockResolvedValue({ error: null });
    await authSignOut();
    expect(signOut).toHaveBeenCalledOnce();
  });
});
