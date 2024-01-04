declare global {
	interface Window {
		mediaExperiments: {
			bigImageSizeThreshold: number;
			bigVideoSizeThreshold: number;
		};
	}

	const MEDIAPIPE_CDN_URL: string;
}

export {};
