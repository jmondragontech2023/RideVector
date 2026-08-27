/** Tracks in-flight geolocation so stale callbacks can be ignored. */
export class LocationSession {
  private token = 0;

  invalidate(): void {
    this.token += 1;
  }

  begin(): number {
    return ++this.token;
  }

  isCurrent(token: number): boolean {
    return token === this.token;
  }
}

export function shouldApplyLocationResult(session: LocationSession, token: number): boolean {
  return session.isCurrent(token);
}
