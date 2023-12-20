import { type BlockInstance } from '@wordpress/blocks';

import type {
	Attachment,
	ImageFormat,
	ImageLibrary,
	ThumbnailGeneration,
} from '@mexp/upload-media';

export type BulkOptimizationAttachmentData = Pick<
	Attachment,
	'id' | 'url' | 'fileSize'
> & {
	posterUrl: Attachment[ 'url' ];
	clientId: BlockInstance[ 'clientId' ];
	isUploading: boolean;
	isOptimized: boolean;
	isFetched: boolean;
};

export type MediaPreferences = {
	// General.
	requireApproval: boolean;
	optimizeOnUpload: boolean;
	thumbnailGeneration: ThumbnailGeneration;
	imageLibrary: ImageLibrary;
	bigImageSizeThreshold: number;
	// Formats.
	default_outputFormat: ImageFormat;
	jpeg_outputFormat: ImageFormat;
	jpeg_quality: number;
	png_outputFormat: ImageFormat;
	png_quality: number;
	webp_outputFormat: ImageFormat;
	webp_quality: number;
	avif_outputFormat: ImageFormat;
	avif_quality: number;
	heic_outputFormat: ImageFormat;
	heic_quality: number;
	gif_outputFormat: ImageFormat;
	gif_quality: number;
	gif_convert: boolean;
	// Media recording.
	videoInput?: string;
	audioInput?: string;
	videoEffect: 'none' | 'blur';
};
