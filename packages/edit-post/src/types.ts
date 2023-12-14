import { type BlockInstance } from '@wordpress/blocks';

import type { Attachment, ImageFormat, ImageLibrary } from '@mexp/upload-media';

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
	bigImageSizeThreshold: number;
	clientSideThumbnails: boolean;
	optimizeOnUpload: boolean;
	imageLibrary: ImageLibrary;
	imageFormat: ImageFormat;
	imageQuality: number;
	// Media recording.
	videoInput?: string;
	audioInput?: string;
	videoEffect: 'none' | 'blur';
};
