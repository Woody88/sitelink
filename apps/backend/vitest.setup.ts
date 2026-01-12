// Disable OpenTelemetry in tests to avoid node:os import issues
if (globalThis) {
  // @ts-expect-error - Disabling OpenTelemetry for testing
  globalThis.process = globalThis.process || {};
  // @ts-expect-error - Disabling OpenTelemetry for testing
  globalThis.process.env = globalThis.process.env || {};
  // @ts-expect-error - Disable OpenTelemetry
  globalThis.process.env.OTEL_SDK_DISABLED = "true";
}
