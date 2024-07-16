import { dispatch } from '@wordpress/data';

import { store as uploadStore } from './store';

export { uploadStore as store };

export { MediaError } from './mediaError';

export { canTranscodeFile } from './utils';

export type {
	ImageFormat,
	ImageLibrary,
	ImageSizeCrop,
	ThumbnailGeneration,
	VideoFormat,
	AudioFormat,
} from './store/types';

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
