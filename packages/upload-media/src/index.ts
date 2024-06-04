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
