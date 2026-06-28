/**
 * Pure, platform-agnostic state for the guest -> register -> resume transition
 * shared by every scan mode. The hook (useRevealGate) is thin glue over this;
 * keeping the once-only logic here makes it unit-testable in the node env and a
 * clean candidate for packages/core when the mobile app lands.
 *
 * Lifecycle: gateInit() -> (guest taps reveal) gateArm() -> (each render)
 * gateResolve(state, signedIn, ready). `resolved` guarantees the deferred
 * action runs at most once.
 */
export interface GateState {
  /** The guest tapped "reveal" and was sent to register. */
  pending: boolean;
  /** The deferred action has already fired — never fire it again. */
  resolved: boolean;
}

export function gateInit(): GateState {
  return { pending: false, resolved: false };
}

/** Arm the gate when the guest requests the reveal (and is sent to register). */
export function gateArm(state: GateState): GateState {
  return { ...state, pending: true };
}

/**
 * Decide whether the deferred reveal should run now. Returns the next state and
 * a one-shot `resume` flag (true exactly once, when armed + signed-in + the user
 * can afford the reveal).
 */
export function gateResolve(
  state: GateState,
  signedIn: boolean,
  ready: boolean,
): { state: GateState; resume: boolean } {
  if (state.pending && !state.resolved && signedIn && ready) {
    return { state: { pending: false, resolved: true }, resume: true };
  }
  return { state, resume: false };
}
