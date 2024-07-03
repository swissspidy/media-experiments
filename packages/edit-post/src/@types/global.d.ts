declare global {
	interface Window {
		mediaExperiments: {
			bigImageSizeThreshold: number;
			bigVideoSizeThreshold: number;
			defaultImageOutputFormats: Record< string, string >;
			jpegInterlaced: boolean;
			pngInterlaced: boolean;
			gifInterlaced: boolean;
		};
	}
}

export type {};
