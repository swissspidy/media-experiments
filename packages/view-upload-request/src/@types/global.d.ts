import { ImageSizeCrop } from '@mexp/upload-media';

declare global {
	interface Window {
		mediaExperiments: {
			availableImageSizes: Record< string, ImageSizeCrop >;
			bigImageSizeThreshold: number;
			allowedMimeTypes?: Record< string, string > | null;
			uploadRequest?: string;
		};
	}
}

export {};
