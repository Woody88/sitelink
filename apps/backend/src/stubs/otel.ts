// Stub for OpenTelemetry modules that require node:os
// This allows tests to run in Cloudflare Workers environment

export const Resource = {
	empty: () => ({}),
	default: () => ({}),
};

export const hostDetector = {
	detect: () => Promise.resolve({}),
};

export const osDetector = {
	detect: () => Promise.resolve({}),
};

export const processDetector = {
	detect: () => Promise.resolve({}),
};

export const trace = {
	getTracer: () => ({
		startSpan: () => ({
			end: () => {},
			setAttribute: () => {},
			setStatus: () => {},
			recordException: () => {},
		}),
	}),
};

export const SpanStatusCode = {
	OK: 0,
	ERROR: 1,
	UNSET: 2,
};

export default {};
