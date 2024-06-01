import type { ImageSizeCrop } from '../store/types';

declare global {
	interface Window {
		mediaExperiments: {
			availableImageSizes: Record< string, ImageSizeCrop >;
			allowedMimeTypes?: Record< string, string > | null;
			mediaSourceTerms: Record< string, number >;
		};
	}
}
