import {
	uploadMedia as originalUploadMedia,
	type AdditionalData,
	type OnChangeHandler,
} from '@mexp/upload-media';

import { dispatch, select, subscribe } from '@wordpress/data';
import { store as blockEditorStore } from '@wordpress/block-editor';
import { store as editorStore } from '@wordpress/editor';
import { store as noticesStore } from '@wordpress/notices';

type OnErrorHandler = ( message: string ) => void;

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

const noop = () => {};

// TODO: Maybe create snackbar notices? Perhaps just for debugging.
const { createInfoNotice, createSuccessNotice, createErrorNotice } =
	dispatch( noticesStore );

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
 *
 * @param args
 * @param args.allowedTypes
 * @param args.additionalData
 * @param args.filesList
 * @param args.maxUploadFileSize
 * @param args.onError
 * @param args.onFileChange
 */
function uploadMedia( {
	allowedTypes,
	additionalData = {},
	filesList,
	maxUploadFileSize,
	onError = noop,
	onFileChange,
}: UploadMediaArgs ) {
	const { getCurrentPostId, getEditorSettings } = select( editorStore );
	const wpAllowedMimeTypes = getEditorSettings().allowedMimeTypes;
	maxUploadFileSize =
		maxUploadFileSize || getEditorSettings().maxUploadFileSize;

	originalUploadMedia( {
		allowedTypes,
		filesList,
		onFileChange,
		additionalData: {
			post: getCurrentPostId(),
			...additionalData,
		},
		maxUploadFileSize,
		onError: ( { message }: Error ) => onError( message ),
		wpAllowedMimeTypes,
	} );
}

// Subscribe to state updates so that we can override the mediaUpload() function at the right time.
subscribe( () => {
	if ( ! select( editorStore ).getEditorSettings().maxUploadFileSize ) {
		return;
	}

	if ( ! select( blockEditorStore ).getSettings().mediaUpload ) {
		return;
	}

	if (
		select( blockEditorStore ).getSettings().mediaUpload === uploadMedia
	) {
		return;
	}

	dispatch( blockEditorStore ).updateSettings( { mediaUpload: uploadMedia } );

	// addFilter(
	// 	'editor.MediaUpload',
	// 	'media-experiments/replace-media-upload',
	// 	replaceMediaUpload
	// );
}, blockEditorStore );
