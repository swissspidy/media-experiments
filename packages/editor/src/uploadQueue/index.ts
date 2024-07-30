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
 * Similar to the mediaUpload() function from `@wordpress/editor`,
 * this is a wrapper around uploadMedia() from `@mexp/media-utils`
 * that injects the current post ID.
 *
 * @param $0                   Parameters object passed to the function.
 * @param $0.allowedTypes      Array with the types of media that can be uploaded, if unset all types are allowed.
 * @param $0.additionalData    Additional data to include in the request.
 * @param $0.filesList         List of files.
 * @param $0.maxUploadFileSize Maximum upload size in bytes allowed for the site.
 * @param $0.onError           Function called when an error happens.
 * @param $0.onFileChange      Function called each time a file or a temporary representation of the file is available.
 * @param $0.signal            Abort signal.
 */
function editorUploadMedia( {
	allowedTypes,
	additionalData = {},
	filesList,
	maxUploadFileSize,
	onError = noop,
	onFileChange,
	signal,
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
		signal,
	} );
}

/**
 * Verifies whether the file is within the file upload size limits for the site.
 *
 * Intended to live in `@wordpress/editor` as a wrapper around
 * validateFileSize() from `@mexp/media-utils`
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
 * Intended to live in `@wordpress/editor` as a wrapper around
 * validateMimeType() and validateMimeTypeForUser() from `@mexp/media-utils`
 * that injects the current site's mime type limits.
 *
 * @param file         File object.
 * @param allowedTypes Array with the types of media that can be uploaded, if unset all types are allowed.
 */
function editorValidateMimeType( file: File, allowedTypes?: string[] ) {
	const { getEditorSettings } = select( editorStore );
	const wpAllowedMimeTypes = getEditorSettings().allowedMimeTypes;

	validateMimeTypeForUser( file, wpAllowedMimeTypes );
	validateMimeType( file, allowedTypes );
}

/**
 * Upload a media file when the file upload button is activated
 * or when adding a file to the editor via drag & drop.
 *
 * This function is intended to eventually live
 * in the `@wordpress/block-editor` package, allowing
 * to perform the client-side file processing before eventually
 * uploading the media to WordPress.
 *
 * @param $0                Parameters object passed to the function.
 * @param $0.allowedTypes   Array with the types of media that can be uploaded, if unset all types are allowed.
 * @param $0.additionalData Additional data to include in the request.
 * @param $0.filesList      List of files.
 * @param $0.onError        Function called when an error happens.
 * @param $0.onFileChange   Function called each time a file or a temporary representation of the file is available.
 * @param $0.onSuccess      Function called once a file has completely finished uploading, including thumbnails.
 * @param $0.onBatchSuccess Function called once all files in a group have completely finished uploading, including thumbnails.
 */
export default function blockEditorUploadMedia( {
	allowedTypes,
	additionalData = {},
	filesList,
	onError = noop,
	onFileChange,
	onSuccess,
	onBatchSuccess,
}: Parameters< typeof originalUploadMedia >[ 0 ] & {
	onError?: ( message: string ) => void;
	onBatchSuccess: () => void;
} ) {
	const validFiles = [];

	for ( const mediaFile of filesList ) {
		// TODO: Consider using the _async_ isHeifImage() function from `@mexp/upload-media`
		const isHeifImage = [ 'image/heic', 'image/heif' ].includes(
			mediaFile.type
		);

		/*
		 Check if the caller (e.g. a block) supports this mime type.
		 Special case for file types such as HEIC which will be converted before upload anyway.
		 Another check will be done before upload.
		*/
		if ( ! isHeifImage ) {
			try {
				editorValidateMimeType( mediaFile, allowedTypes );
			} catch ( error: unknown ) {
				onError( error as Error );
				continue;
			}
		}

		// Verify if file is greater than the maximum file upload size allowed for the site.
		// TODO: Consider removing, as file could potentially be compressed first.
		try {
			editorValidateFileSize( mediaFile );
		} catch ( error: unknown ) {
			onError( error as Error );
			continue;
		}

		validFiles.push( mediaFile );
	}

	void dispatch( uploadStore ).addItems( {
		files: validFiles,
		onChange: onFileChange,
		onSuccess,
		onBatchSuccess,
		onError: ( { message }: Error ) => onError( message ),
		additionalData,
	} );
}

/*
 Make the upload queue aware of the function for uploading to the server.
 The list of available image sizes is passed via an inline script
 and needs to be saved in the store first.
*/
void dispatch( uploadStore ).updateSettings( {
	mediaUpload: editorUploadMedia,
	mediaSideload: originalSideloadMedia,
	imageSizes: window.mediaExperiments.availableImageSizes,
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
}, blockEditorStore );
