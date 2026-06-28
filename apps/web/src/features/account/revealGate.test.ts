import { describe, it, expect } from 'vitest';
import { gateInit, gateArm, gateResolve } from './revealGate';

describe('revealGate', () => {
  it('starts un-armed and unresolved', () => {
    expect(gateInit()).toEqual({ pending: false, resolved: false });
  });

  it('gateArm sets pending', () => {
    expect(gateArm(gateInit())).toEqual({ pending: true, resolved: false });
  });

  it('does not resume while un-armed (signed-in user just browsing)', () => {
    const { resume } = gateResolve(gateInit(), true, true);
    expect(resume).toBe(false);
  });

  it('does not resume while still a guest', () => {
    const armed = gateArm(gateInit());
    expect(gateResolve(armed, false, true).resume).toBe(false);
  });

  it('does not resume until the user can afford it', () => {
    const armed = gateArm(gateInit());
    expect(gateResolve(armed, true, false).resume).toBe(false);
  });

  it('resumes once when armed + signed-in + ready, then marks resolved', () => {
    const armed = gateArm(gateInit());
    const first = gateResolve(armed, true, true);
    expect(first.resume).toBe(true);
    expect(first.state).toEqual({ pending: false, resolved: true });
  });

  it('never resumes twice (resolved guards re-entry)', () => {
    const armed = gateArm(gateInit());
    const first = gateResolve(armed, true, true);
    const second = gateResolve(first.state, true, true);
    expect(second.resume).toBe(false);
  });
});
