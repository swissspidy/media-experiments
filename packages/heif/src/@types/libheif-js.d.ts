declare module 'libheif-js' {
	interface DecodeResult {
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
			callback: (result: ImageData | null) => void
		) => void;
	}

	type DecodeResultType = DecodeResult[];

	class HeifDecoder implements HeifDecoder {
		constructor();
		decode(buffer: ArrayBuffer | Uint8Array): DecodeResultType;
	}
}
