import { describe, expect, it } from 'vitest';
import { LocationSession, shouldApplyLocationResult } from './location-session';

describe('LocationSession', () => {
  it('supersedes an in-flight location request when invalidated', () => {
    const session = new LocationSession();
    const inFlight = session.begin();

    session.invalidate();

    expect(session.isCurrent(inFlight)).toBe(false);
  });

  it('ignores stale location results after a manual start selection', () => {
    const session = new LocationSession();
    const stale = session.begin();

    session.invalidate();

    expect(shouldApplyLocationResult(session, stale)).toBe(false);
  });

  it('accepts the current location result when not invalidated', () => {
    const session = new LocationSession();
    const current = session.begin();

    expect(shouldApplyLocationResult(session, current)).toBe(true);
  });

  it('supersedes a prior request when a new one begins', () => {
    const session = new LocationSession();
    const first = session.begin();
    const second = session.begin();

    expect(session.isCurrent(first)).toBe(false);
    expect(shouldApplyLocationResult(session, second)).toBe(true);
  });
});
