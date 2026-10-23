import { computeIntegration, type IntegrationRequest, type IntegrationResponse } from "./integration-run";

export type { IntegrationResponse };

/**
 * Runs integrations in a Web Worker so long ones (the triple integral reaches
 * millions of evaluations) do not freeze the page. A new run or cancel()
 * terminates the one in progress; its promise resolves with null, so a stale
 * result can never reach the UI.
 */
export class IntegrationRunner {
  private worker: Worker | null = null;
  private nextId = 0;
  private pending: { id: number; resolve: (response: IntegrationResponse | null) => void } | null = null;

  run(request: Omit<IntegrationRequest, "id">): Promise<IntegrationResponse | null> {
    this.cancel();
    const id = ++this.nextId;
    const message: IntegrationRequest = { ...request, id };
    return new Promise((resolve) => {
      this.pending = { id, resolve };
      if (typeof Worker === "undefined") {
        // No worker support: same computation on the main thread, after the busy state paints.
        window.setTimeout(() => this.settle(computeIntegration(message, "main")), 0);
        return;
      }
      const worker = this.ensureWorker();
      worker.postMessage(message);
    });
  }

  /** Stops the running integration, if any. */
  cancel() {
    if (!this.pending) return;
    this.pending.resolve(null);
    this.pending = null;
    // A busy worker cannot be interrupted: it is discarded and recreated on the next run.
    this.worker?.terminate();
    this.worker = null;
  }

  dispose() {
    this.cancel();
    this.worker?.terminate();
    this.worker = null;
  }

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;
    const worker = new Worker(new URL("./integration.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<IntegrationResponse>) => this.settle(event.data);
    worker.onerror = (event) => {
      event.preventDefault();
      const id = this.pending?.id ?? 0;
      this.settle({ id, outcome: { ok: false, message: "El cálculo se interrumpió por un error inesperado.", detail: event.message }, elapsedMs: 0, thread: "worker" });
      worker.terminate();
      if (this.worker === worker) this.worker = null;
    };
    this.worker = worker;
    return worker;
  }

  private settle(response: IntegrationResponse) {
    if (!this.pending || this.pending.id !== response.id) return;
    const { resolve } = this.pending;
    this.pending = null;
    resolve(response);
  }
}
