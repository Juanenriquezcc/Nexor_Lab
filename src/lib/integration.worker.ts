import { computeIntegration, type IntegrationRequest } from "./integration-run";

// Dedicated worker scope; the DOM lib types `self` as Window.
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<IntegrationRequest>) => void) | null;
  postMessage: (message: unknown) => void;
};

scope.onmessage = (event) => {
  scope.postMessage(computeIntegration(event.data, "worker"));
};
