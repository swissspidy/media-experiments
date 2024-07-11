declare module 'libheif-js/libheif-wasm/libheif-bundle.js' {
	type DecodeResult = {
		img: {
			is_primary: boolean;
			thumbnails: number;
			width: number;
			height: number;
		} | null;
		get_width: () => number;
		get_height: () => number;
		is_primary: () => boolean;
		display: (
			base: ImageData,
			callback: ( result: ImageData | null ) => void
		) => void;
	};

	type DecodeResultType = DecodeResult[];

	class HeifDecoder {
		decoder: unknown;

		constructor();
		decode( buffer: ArrayBuffer | Uint8Array ): DecodeResultType;
	}

	type Class< T = any > = new ( ...args: any[] ) => T;

	function libheif(): { HeifDecoder: Class< HeifDecoder > };

	export = libheif;
}
