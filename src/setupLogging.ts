/* eslint-disable no-console, @typescript-eslint/no-explicit-any -- Intentional console suppression for production and window extensions for debugging */
// Global suppression of non-error console output (always active)
// Replaces console.log/info/debug with no-ops while preserving warn/error.
// Original methods stored for optional manual debugging from dev tools:
//   window.__originalConsole.log('message')

const noop = () => {};

if (typeof window !== 'undefined') {
	if (!(window as any).__originalConsole) {
		(window as any).__originalConsole = {
			log: console.log.bind(console),
			info: console.info.bind(console),
			debug: console.debug.bind(console),
		};
	}

	console.log = noop;
	console.info = noop;
	console.debug = noop;

	;(window as any).enableDebugLogs = () => {
		const original = (window as any).__originalConsole;
		if (original) {
			console.log = original.log;
			console.info = original.info;
			console.debug = original.debug;
			original.log('[logging] debug logs re-enabled');
		}
	};

	;(window as any).disableDebugLogs = () => {
		console.log = noop;
		console.info = noop;
		console.debug = noop;
	};
}
