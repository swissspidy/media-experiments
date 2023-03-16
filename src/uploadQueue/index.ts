import { v4 as uuidv4 } from 'uuid';

import { sprintf, __ } from '@wordpress/i18n';
import { select, dispatch, subscribe } from '@wordpress/data';
import { store as blockEditorStore } from '@wordpress/block-editor';
import { store as editorStore } from '@wordpress/editor';
import { store as noticesStore } from '@wordpress/notices';
import { store as coreStore } from '@wordpress/core-data';

import { store as uploadStore } from './store';
import type {
	AdditionalData,
	OnChangeHandler,
	OnErrorHandler,
	QueueItem,
	WP_REST_API_Term,
} from './store/types';
import UploadError from './uploadError';
import { canTranscodeFile, getMimeTypesArray } from './utils';

const { createInfoNotice, createSuccessNotice, createErrorNotice } =
	dispatch(noticesStore);

const noop = () => {};

interface UploadMediaArgs {
	// Additional data to include in the request.
	additionalData?: AdditionalData;
	// Array with the types of media that can be uploaded, if unset all types are allowed.
	allowedTypes?: string[];
	// List of files.
	filesList: File[];
	// Maximum upload size in bytes allowed for the site.
	maxUploadFileSize?: number;
	// Function called when an error happens.
	onError?: OnErrorHandler;
	// Function called each time a file or a temporary representation of the file is available.
	onFileChange?: OnChangeHandler;
}

/**
 * Upload a media file when the file upload button is activated
 * or when adding a file to the editor via drag & drop.
 *
 * Performs some client-side file processing before eventually
 * uploading the media to WordPress.
 *
 * Similar to the mediaUpload() function from @wordpress/editor,
 * this is a wrapper around uploadMedia() from @wordpress/media-utils
 * that injects the current post ID.
 */
export default function uploadMedia({
	allowedTypes,
	additionalData = {},
	filesList,
	maxUploadFileSize,
	onError = noop,
	onFileChange,
}: UploadMediaArgs) {
	const { getEditorSettings } = select(editorStore);
	const wpAllowedMimeTypes = getEditorSettings().allowedMimeTypes;
	maxUploadFileSize =
		maxUploadFileSize || getEditorSettings().maxUploadFileSize;

	// Allowed type specified by consumer.
	const isAllowedType = (fileType: string) => {
		if (!allowedTypes) {
			return true;
		}

		return allowedTypes.some((allowedType) => {
			// If a complete mimetype is specified verify if it matches exactly the mime type of the file.
			if (allowedType.includes('/')) {
				return allowedType === fileType;
			}
			// Otherwise a general mime type is used, and we should verify if the file mimetype starts with it.
			return fileType.startsWith(`${allowedType}/`);
		});
	};

	// Allowed types for the current WP_User.
	const allowedMimeTypesForUser = getMimeTypesArray(wpAllowedMimeTypes);
	const isAllowedMimeTypeForUser = (fileType: string) => {
		return allowedMimeTypesForUser.includes(fileType);
	};

	const validFiles = [];

	for (const mediaFile of filesList) {
		// Verify if user is allowed to upload this mime type.
		// Defer to the server when type not detected.
		if (
			allowedMimeTypesForUser &&
			mediaFile.type &&
			!isAllowedMimeTypeForUser(mediaFile.type) &&
			!canTranscodeFile(mediaFile)
		) {
			onError(
				new UploadError({
					code: 'MIME_TYPE_NOT_ALLOWED_FOR_USER',
					message: sprintf(
						// translators: %s: file name.
						__(
							'%s: Sorry, you are not allowed to upload this file type.',
							'media-experiments'
						),
						mediaFile.name
					),
					file: mediaFile,
				})
			);
			continue;
		}

		// Check if the block supports this mime type.
		// Defer to the server when type not detected.
		if (mediaFile.type && !isAllowedType(mediaFile.type)) {
			onError(
				new UploadError({
					code: 'MIME_TYPE_NOT_SUPPORTED',
					message: sprintf(
						// translators: %s: file name.
						__(
							'%s: Sorry, this file type is not supported here.',
							'media-experiments'
						),
						mediaFile.name
					),
					file: mediaFile,
				})
			);
			continue;
		}

		// Verify if file is greater than the maximum file upload size allowed for the site.
		// TODO: Check if file can be compressed via FFmpeg
		if (maxUploadFileSize && mediaFile.size > maxUploadFileSize) {
			onError(
				new UploadError({
					code: 'SIZE_ABOVE_LIMIT',
					message: sprintf(
						// translators: %s: file name.
						__(
							'%s: This file exceeds the maximum upload size for this site.',
							'media-experiments'
						),
						mediaFile.name
					),
					file: mediaFile,
				})
			);
			continue;
		}

		// Don't allow empty files to be uploaded.
		if (mediaFile.size <= 0) {
			onError(
				new UploadError({
					code: 'EMPTY_FILE',
					message: sprintf(
						// translators: %s: file name.
						__('%s: This file is empty.', 'media-experiments'),
						mediaFile.name
					),
					file: mediaFile,
				})
			);
			continue;
		}

		validFiles.push(mediaFile);
	}

	const post = select(editorStore).getCurrentPostId();

	const batchId = uuidv4();

	// TODO: why exactly is HEIF slipping through here?

	for (const file of validFiles) {
		dispatch(uploadStore).addItem({
			file,
			batchId,
			onChange: onFileChange,
			onError,
			additionalData: {
				post,
				...additionalData,
			},
		});
	}
}

// Subscribe to state updates so that we can override the mediaUpload() function at the right time.
subscribe(() => {
	if (!select(editorStore).getEditorSettings().maxUploadFileSize) {
		return;
	}

	if (!select(blockEditorStore).getSettings().mediaUpload) {
		return;
	}

	if (select(blockEditorStore).getSettings().mediaUpload === uploadMedia) {
		return;
	}

	dispatch(blockEditorStore).updateSettings({ mediaUpload: uploadMedia });

	// addFilter(
	// 	'editor.MediaUpload',
	// 	'media-experiments/replace-media-upload',
	// 	replaceMediaUpload
	// );
}, blockEditorStore);

// Loop through new items, add additional metadata where needed,
// and eventually upload items to the server.
subscribe(() => {
	const items: QueueItem[] = select(uploadStore).getPendingItems();
	for (const { id } of items) {
		void dispatch(uploadStore).prepareItem(id);
	}
}, uploadStore);

subscribe(() => {
	const items: QueueItem[] = select(uploadStore).getTranscodedItems();
	for (const { id } of items) {
		void dispatch(uploadStore).uploadItem(id);
	}
}, uploadStore);

// Try to get dimensions and poster for placeholder resources.
// This way we can show something more meaningful to the user before transcoding has finished.
// Since this uses ffmpeg, we're going to limit this to one at a time.

// For pending video items without a poster still, use FFmpeg to generate a poster.
// This way we can show something more meaningful to the user before transcoding has finished.
// Since this uses FFmpeg, we're going to limit this to one at a time.

// TODO: Generate poster with FFmpeg if missing.
// Could be after converting gif or similar.
// Update poster in video block (should revoke temp blob URL)
// When video upload finishes, also upload poster image.

// Set temporary URL to create placeholder media file, this is replaced
// with final file from media gallery when upload is `done` below.
// TODO: remove in favor of logic below.

subscribe(() => {
	const items: QueueItem[] = select(uploadStore).getInProgressItems();
	for (const item of items) {
		const { attachment, onChange } = item;

		const { poster, ...media } = attachment;
		// Video block expects such a structure for the poster.
		// https://github.com/WordPress/gutenberg/blob/e0a413d213a2a829ece52c6728515b10b0154d8d/packages/block-library/src/video/edit.js#L154
		if (poster) {
			media.image = {
				src: poster,
			};
		}

		onChange?.([media]);
	}
}, uploadStore);

subscribe(() => {
	const items: QueueItem[] = select(uploadStore).getPendingTranscodingItems();
	for (const { id } of items) {
		void dispatch(uploadStore).maybeTranscodeItem(id);
	}
}, uploadStore);

subscribe(() => {
	const items: QueueItem[] = select(uploadStore).getUploadedItems();

	for (const item of items) {
		const { id, onChange, onSuccess, attachment } = item;
		onChange?.([attachment]);
		onSuccess?.([attachment]);
		void dispatch(uploadStore).completeItem(id);
	}
}, uploadStore);

subscribe(() => {
	const items: QueueItem[] = select(uploadStore).getCancelledItems();
	for (const item of items) {
		const { id, error, onError } = item;
		onError?.(error);
		dispatch(uploadStore).removeItem(id);
	}
}, uploadStore);

// The WordPress REST API requires passing term IDs instead of slugs.
// We are storing them here in a simple slug => id map so that we can
// still reference them by slug to make things a bit easier.
const unsubscribeCoreStore = subscribe(() => {
	const termObjects: WP_REST_API_Term[] | null = select(
		coreStore
	).getEntityRecords('taxonomy', 'mexp_media_source');
	if (termObjects === null) {
		return;
	}

	const terms: Record<string, number> = {};

	for (const termObject of termObjects) {
		terms[termObject.slug] = termObject.id;
	}

	dispatch(uploadStore).setMediaSourceTerms(terms);
	unsubscribeCoreStore();
}, coreStore);
