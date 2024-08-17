import type { ImageSizeCrop } from '@mexp/upload-media';

declare global {
	interface Window {
		mediaExperiments: {
			allowedMimeTypes?: Record< string, string > | null;
			uploadRequest: string;
			allowedTypes: string[];
			accept: string[];
			multiple: boolean;
			maxUploadFileSize: number;
		};
	}
}
