import type Vips from 'wasm-vips';

declare global {
	interface Window {
		Vips: typeof Vips;
	}
}

export {};
