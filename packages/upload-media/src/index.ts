import { dispatch } from '@wordpress/data';

import { store as uploadStore } from './store';
import type {
	AdditionalData,
	Attachment,
	OnChangeHandler,
	OnErrorHandler,
	RestAttachment,
	ImageFormat,
	ImageLibrary,
	ImageSizeCrop,
	ThumbnailGeneration,
	VideoFormat,
	AudioFormat,
} from './store/types';
import { UploadError } from './uploadError';

export { uploadMedia } from './uploadMedia';
export { fetchRemoteFile, transformAttachment } from './utils';

export type {
	AdditionalData,
	OnChangeHandler,
	OnErrorHandler,
	Attachment,
	RestAttachment,
	ImageFormat,
	ImageLibrary,
	ImageSizeCrop,
	ThumbnailGeneration,
	VideoFormat,
	AudioFormat,
};

export { uploadStore as store, UploadError };

/*
 Try to get dimensions and poster for placeholder resources.
 This way we can show something more meaningful to the user before transcoding has finished.
 Since this uses ffmpeg, we're going to limit this to one at a time.

 For pending video items without a poster still, use FFmpeg to generate a poster.
 This way we can show something more meaningful to the user before transcoding has finished.
 Since this uses FFmpeg, we're going to limit this to one at a time.

 TODO: Generate poster with FFmpeg if missing.
 Could be after converting gif or similar.
 Update poster in video block (should revoke temp blob URL)
 When video upload finishes, also upload poster image.

 Set temporary URL to create placeholder media file, this is replaced
 with final file from media gallery when upload is `done` below.
 TODO: remove in favor of logic below.
*/

// Move to uploadItem action
// subscribe( () => {
// 	const items: QueueItem[] = select( uploadStore ).getUploadedItems();
//
// 	for ( const item of items ) {
// 		const { id, onChange, onSuccess, onBatchSuccess, attachment, batchId } =
// 			item;
// 		if ( attachment ) {
// 			onChange?.( [ attachment ] );
// 			onSuccess?.( [ attachment ] );
// 		}
// 		if ( batchId && select( uploadStore ).isBatchUploaded( batchId ) ) {
// 			onBatchSuccess?.();
// 		}
// 		void dispatch( uploadStore ).completeItem( id );
// 	}
// }, uploadStore );

/*
 The WordPress REST API requires passing term IDs instead of slugs.
 We are storing them here in a simple slug => id map so that we can
 still reference them by slug to make things a bit easier.
*/

void dispatch( uploadStore ).setMediaSourceTerms(
	window.mediaExperiments.mediaSourceTerms
);

/*
 The list of available image sizes is passed via an inline script
 and needs to be saved in the store first.
*/
void dispatch( uploadStore ).setImageSizes(
	window.mediaExperiments.availableImageSizes
);
