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

	const MEDIAPIPE_CDN_URL: string;
}

export type {};
