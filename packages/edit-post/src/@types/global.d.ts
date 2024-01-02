declare global {
	interface Window {
		mediaExperiments: {
			bigImageSizeThreshold: number;
		};
	}

	const MEDIAPIPE_CDN_URL: string;
}

export {};
