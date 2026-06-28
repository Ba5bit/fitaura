import { useCallback, useEffect, useRef, useState } from 'react';
import { useAccount } from './AccountContext';
import { gateArm, gateInit, gateResolve, type GateState } from './revealGate';

export interface RevealGateOptions {
  /** Path passed to openAuth so finishAuth returns the user to the run route. */
  redirectTo: string;
  /** True once the (now signed-in) user can afford this reveal — e.g. Solo: canScan; FvF: credits >= 2. */
  readyToResume: boolean;
  /** The guest's deferred spend+generate+navigate action. Runs exactly once after register. */
  onResume: () => void | Promise<void>;
}

export interface RevealGate {
  /** Call from the GUEST reveal CTA: arms the gate and opens the auth modal. */
  requestRegister: () => void;
  /** True while a guest is mid-registration — for CTA disabled state / labels. */
  pending: boolean;
}

/**
 * Shared guest -> register -> resume transition for every scan mode. Signed-in
 * users do NOT go through here (they already generated during the scan timeline);
 * this is purely the guest deferral, so it can never double-spend.
 */
export function useRevealGate({ redirectTo, readyToResume, onResume }: RevealGateOptions): RevealGate {
  const { signedIn, openAuth } = useAccount();
  const [gate, setGate] = useState<GateState>(gateInit);
  // Latest onResume without re-arming the effect each render.
  const onResumeRef = useRef(onResume);
  onResumeRef.current = onResume;
  // Synchronous one-shot guard: StrictMode double-invokes the effect against the
  // same pre-commit state, so the reducer's `resolved` flag alone isn't enough.
  const firedRef = useRef(false);

  const requestRegister = useCallback(() => {
    setGate((g) => gateArm(g));
    openAuth(redirectTo);
  }, [openAuth, redirectTo]);

  useEffect(() => {
    const { state, resume } = gateResolve(gate, signedIn, readyToResume);
    if (state !== gate) setGate(state);
    if (resume && !firedRef.current) {
      firedRef.current = true;
      void onResumeRef.current();
    }
  }, [gate, signedIn, readyToResume]);

  return { requestRegister, pending: gate.pending };
}
