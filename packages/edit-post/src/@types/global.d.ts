declare global {
	interface Window {
		mediaExperiments: {
			bigImageSizeThreshold: number;
			bigVideoSizeThreshold: number;
			defaultImageOutputFormats: Record< string, string >;
		};
	}

	const MEDIAPIPE_CDN_URL: string;
}

export type {};
