import { type BlockInstance } from '@wordpress/blocks';

import { type Attachment } from '@mexp/upload-media';

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
