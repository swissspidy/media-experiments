import { dispatch, select, subscribe } from '@wordpress/data';
import { store as blockEditorStore } from '@wordpress/block-editor';
import { store as editorStore } from '@wordpress/editor';

import {
	uploadMedia as originalUploadMedia,
	sideloadMedia as originalSideloadMedia,
	validateFileSize,
	validateMimeType,
	validateMimeTypeForUser,
} from '@mexp/media-utils';
import { store as uploadStore } from '@mexp/upload-media';

const noop = () => {};

/**
 * Upload a media file when the file upload button is activated
 * or when adding a file to the editor via drag & drop.
 *
 * Similar to the mediaUpload() function from @wordpress/editor,
 * this is a wrapper around uploadMedia() from @mexp/media-utils
 * that injects the current post ID.
 *
 * @param $0
 * @param $0.allowedTypes
 * @param $0.additionalData
 * @param $0.filesList
 * @param $0.maxUploadFileSize
 * @param $0.onError
 * @param $0.onFileChange
 */
function editorUploadMedia( {
	allowedTypes,
	additionalData = {},
	filesList,
	maxUploadFileSize,
	onError = noop,
	onFileChange,
}: Parameters< typeof originalUploadMedia >[ 0 ] ) {
	const { getCurrentPost, getEditorSettings } = select( editorStore );
	const wpAllowedMimeTypes = getEditorSettings().allowedMimeTypes;
	maxUploadFileSize =
		maxUploadFileSize || getEditorSettings().maxUploadFileSize;

	const currentPost = getCurrentPost();
	// Templates and template parts' numerical ID is stored in `wp_id`.
	const currentPostId =
		currentPost && 'wp_id' in currentPost
			? currentPost.wp_id
			: currentPost?.id;
	const postData = currentPostId ? { post: currentPostId } : {};

	originalUploadMedia( {
		allowedTypes,
		filesList,
		onFileChange,
		additionalData: {
			...postData,
			...additionalData,
		},
		maxUploadFileSize,
		onError,
		wpAllowedMimeTypes,
	} );
}

/**
 * Verifies whether the file is within the file upload size limits for the site.
 *
 * Intended to live in @wordpress/editor as a wrapper around
 * validateFileSize() from @mexp/media-utils
 * that injects the current site's file size limit.
 *
 * @param file File object.
 */
function editorValidateFileSize( file: File ) {
	const { getEditorSettings } = select( editorStore );
	return validateFileSize( file, getEditorSettings().maxUploadFileSize );
}

/**
 * Verifies if the caller (e.g. a block) supports this mime type.
 *
 * Intended to live in @wordpress/editor as a wrapper around
 * validateMimeType() and validateMimeTypeForUser() from @mexp/media-utils
 * that injects the current site's mime type limits.
 *
 * @param file         File object.
 * @param allowedTypes Array with the types of media that can be uploaded, if unset all types are allowed.
 */
function editorValidateMimeType( file: File, allowedTypes?: string[] ) {
	const { getEditorSettings } = select( editorStore );
	const wpAllowedMimeTypes = getEditorSettings().allowedMimeTypes;

	console.log('editorValidateMimeType', wpAllowedMimeTypes, allowedTypes );

	validateMimeTypeForUser( file, wpAllowedMimeTypes );
	validateMimeType( file, allowedTypes );
}

/**
 * Upload a media file when the file upload button is activated
 * or when adding a file to the editor via drag & drop.
 *
 * This function is intended to eventually live
 * in the @wordpress/block-editor package, allowing
 * to perform the client-side file processing before eventually
 * uploading the media to WordPress.
 *
 * @param $0
 * @param $0.allowedTypes
 * @param $0.additionalData
 * @param $0.filesList
 * @param $0.onError
 * @param $0.onFileChange
 */
function blockEditorUploadMedia( {
	allowedTypes,
	additionalData = {},
	filesList,
	onError = noop,
	onFileChange,
}: Parameters< typeof originalUploadMedia >[ 0 ] & {
	onError?: ( message: string ) => void;
} ) {
	const validFiles = [];

	const _validateMimeType =
		select( uploadStore ).getSettings().validateMimeType;

	const _validateFileSize =
		select( uploadStore ).getSettings().validateFileSize;

	for ( const mediaFile of filesList ) {
		// Check if the caller (e.g. a block) supports this mime type.
		// Defer to the server when type not detected.
		if ( _validateMimeType ) {
			try {
				_validateMimeType( mediaFile, allowedTypes );
			} catch ( error: unknown ) {
				onError( error as Error );
				continue;
			}
		}

		// Verify if file is greater than the maximum file upload size allowed for the site.
		// TODO: Consider removing, as file could potentially be compressed first.
		if ( _validateFileSize ) {
			try {
				_validateFileSize( mediaFile );
			} catch ( error: unknown ) {
				onError( error as Error );
				continue;
			}
		}

		validFiles.push( mediaFile );
	}

	void dispatch( uploadStore ).addItems( {
		files: validFiles,
		onChange: onFileChange,
		onError: ( { message }: Error ) => onError( message ),
		additionalData,
	} );
}

/*
 The list of available image sizes is passed via an inline script
 and needs to be saved in the store first.
*/
void dispatch( uploadStore ).setImageSizes(
	window.mediaExperiments.availableImageSizes
);

// Make the upload queue aware of the function for uploading to the server.
void dispatch( uploadStore ).updateSettings( {
	mediaUpload: editorUploadMedia,
	mediaSideload: originalSideloadMedia,
	validateFileSize: editorValidateFileSize,
	validateMimeType: editorValidateMimeType,
} );

// Subscribe to state updates so that we can override the mediaUpload() function at the right time.
subscribe( () => {
	if ( ! select( editorStore ).getEditorSettings().maxUploadFileSize ) {
		return;
	}

	if ( ! select( blockEditorStore ).getSettings().mediaUpload ) {
		return;
	}

	if (
		select( blockEditorStore ).getSettings().mediaUpload ===
		blockEditorUploadMedia
	) {
		return;
	}

	// Update block-editor with the new function that moves everything through a queue.
	void dispatch( blockEditorStore ).updateSettings( {
		mediaUpload: blockEditorUploadMedia,
	} );

	// TODO: Pass `uploadMedia` to uploadStore

	// addFilter(
	// 	'editor.MediaUpload',
	// 	'media-experiments/replace-media-upload',
	// 	replaceMediaUpload
	// );
}, blockEditorStore );
