import type { ImageSizeCrop } from '@mexp/upload-media';

// Keep in sync with PHP.
type MediaSourceTerm =
	| 'media-optimization'
	| 'poster-generation'
	| 'media-import'
	| 'gif-conversion'
	| 'subtitles-generation';

declare global {
	interface Window {
		mediaExperiments: {
			bigImageSizeThreshold: number;
			bigVideoSizeThreshold: number;
			defaultImageOutputFormats: Record< string, string >;
			jpegInterlaced: boolean;
			pngInterlaced: boolean;
			gifInterlaced: boolean;
			availableImageSizes: Record< string, ImageSizeCrop >;
			mediaSourceTerms: Record< MediaSourceTerm, number >;
		};
	}
}

export type {};
