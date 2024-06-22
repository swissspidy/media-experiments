import type { ImageSizeCrop } from '@mexp/upload-media';

declare global {
	interface Window {
		mediaExperiments: {
			availableImageSizes: Record< string, ImageSizeCrop >;
			bigImageSizeThreshold: number;
			bigVideoSizeThreshold: number;
			jpegInterlaced: boolean;
			pngInterlaced: boolean;
			gifInterlaced: boolean;
			allowedMimeTypes?: Record< string, string > | null;
			uploadRequest: string;
			allowedTypes: string[];
			accept: string[];
			multiple: boolean;
		};
	}
}
