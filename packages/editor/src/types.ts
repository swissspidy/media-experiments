import type { BlockInstance } from '@wordpress/blocks';

import type { Attachment } from '@mexp/media-utils';
import type {
	AudioFormat,
	ImageFormat,
	ImageLibrary,
	ThumbnailGeneration,
	VideoFormat,
} from '@mexp/upload-media';

export type BulkOptimizationAttachmentData = Pick<
	Attachment,
	'id' | 'url' | 'fileSize' | 'fileName'
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
	bigVideoSizeThreshold: number;
	keepOriginal: boolean;
	// Formats.
	default_outputFormat: ImageFormat;
	default_quality: number;
	default_interlaced: boolean;
	jpeg_outputFormat: ImageFormat;
	jpeg_quality: number;
	jpeg_interlaced: boolean;
	png_outputFormat: ImageFormat;
	png_quality: number;
	png_interlaced: boolean;
	webp_outputFormat: ImageFormat;
	webp_quality: number;
	webp_interlaced: boolean;
	avif_outputFormat: ImageFormat;
	avif_quality: number;
	avif_interlaced: boolean;
	heic_outputFormat: ImageFormat;
	heic_quality: number;
	heic_interlaced: boolean;
	gif_outputFormat: ImageFormat;
	gif_quality: number;
	gif_interlaced: boolean;
	gif_convert: boolean;
	video_outputFormat: VideoFormat;
	audio_outputFormat: AudioFormat;
	// Media recording.
	videoInput?: string;
	audioInput?: string;
	videoEffect: 'none' | 'blur';
};
