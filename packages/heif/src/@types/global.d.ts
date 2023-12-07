import type { HeifDecoder } from 'libheif-js';

declare global {
	interface Window {
		libheif: () => ({
			HeifDecoder: typeof HeifDecoder;
		});
	}
}

export {};
