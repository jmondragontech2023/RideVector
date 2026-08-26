/** Tracks in-flight POC route generation so stale responses can be ignored. */
export class GenerationSession {
  private token = 0;
  private activeController: AbortController | null = null;

  invalidate(): void {
    this.token += 1;
    this.activeController?.abort();
    this.activeController = null;
  }

  begin(): { token: number; abortController: AbortController; signal: AbortSignal } {
    this.activeController?.abort();
    const abortController = new AbortController();
    this.activeController = abortController;
    const token = ++this.token;
    return { token, abortController, signal: abortController.signal };
  }

  isCurrent(token: number): boolean {
    return token === this.token;
  }

  release(abortController: AbortController): void {
    if (this.activeController === abortController) {
      this.activeController = null;
    }
  }
}

export function shouldApplyGenerationResponse(
  session: GenerationSession,
  token: number,
  signal: AbortSignal,
): boolean {
  return !signal.aborted && session.isCurrent(token);
}
