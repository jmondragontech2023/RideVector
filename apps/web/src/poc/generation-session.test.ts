import { describe, expect, it } from 'vitest';
import { GenerationSession, shouldApplyGenerationResponse } from './generation-session';

describe('GenerationSession', () => {
  it('aborts and supersedes an in-flight generation when invalidated', () => {
    const session = new GenerationSession();
    const inFlight = session.begin();

    session.invalidate();

    expect(inFlight.signal.aborted).toBe(true);
    expect(session.isCurrent(inFlight.token)).toBe(false);
  });

  it('ignores stale generation responses after opening a saved route', () => {
    const session = new GenerationSession();
    const stale = session.begin();

    session.invalidate();

    expect(shouldApplyGenerationResponse(session, stale.token, stale.signal)).toBe(false);
  });

  it('accepts the current generation response when not invalidated', () => {
    const session = new GenerationSession();
    const current = session.begin();

    expect(shouldApplyGenerationResponse(session, current.token, current.signal)).toBe(true);
  });

  it('releases the active abort controller without invalidating the token', () => {
    const session = new GenerationSession();
    const current = session.begin();

    session.release(current.abortController);

    expect(session.isCurrent(current.token)).toBe(true);
    expect(current.signal.aborted).toBe(false);
  });
});
