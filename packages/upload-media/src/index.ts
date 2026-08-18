/**
 * Internal dependencies
 */
import { store as uploadStore } from './store';

export { uploadStore as store };

export { UploadError } from './upload-error';
export { sideloadMedia } from './sideload/sideload-media';

export type {
	AdditionalData,
	Attachment,
	CreateRestAttachment,
	CreateSideloadFile,
	OnChangeHandler,
	OnErrorHandler,
	RestAttachment,
	SideloadAdditionalData,
} from './types';

export type {
	ImageFormat,
	ImageLibrary,
	ImageSizeCrop,
	ThumbnailGeneration,
	VideoFormat,
	AudioFormat,
} from './store/types';
