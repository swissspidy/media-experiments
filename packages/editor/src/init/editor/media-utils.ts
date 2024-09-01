/**
 * External dependencies
 */
import {
	uploadMedia as originalUploadMedia,
	sideloadMedia as originalSideloadMedia,
	validateFileSize as originalValidateFileSize,
	validateMimeType as originalValidateMimeType,
	validateMimeTypeForUser as originalValidateMimeTypeForUser,
} from '@mexp/media-utils';

/**
 * WordPress dependencies
 */
import { select } from '@wordpress/data';
import { store as editorStore } from '@wordpress/editor';

const noop = () => {};

export { originalSideloadMedia as mediaSideload };

/**
 * Upload a media file to the server.
 *
 * Injects the current post ID into the original `uploadMedia()` function.
 *
 * @todo MERGE NOTE:
 * Intended to replace the mediaUpload() function from `@wordpress/editor`.
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
export function mediaUpload( {
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
 * @todo MERGE NOTE:
 * Intended to live in `@wordpress/editor` as a wrapper around
 * validateFileSize() from `@mexp/media-utils`
 * that injects the current site's file size limit.
 *
 * @param file File object.
 */
export function validateFileSize( file: File ) {
	const { getEditorSettings } = select( editorStore );
	return originalValidateFileSize(
		file,
		getEditorSettings().maxUploadFileSize
	);
}

/**
 * Verifies if the caller (e.g. a block) supports this mime type.
 *
 * @todo MERGE NOTE:
 * Intended to live in `@wordpress/editor` as a wrapper around
 * validateMimeType() and validateMimeTypeForUser() from `@mexp/media-utils`
 * that injects the current site's mime type limits.
 *
 * @param file         File object.
 * @param allowedTypes Array with the types of media that can be uploaded, if unset all types are allowed.
 */
export function validateMimeType( file: File, allowedTypes?: string[] ) {
	const { getEditorSettings } = select( editorStore );
	const wpAllowedMimeTypes = getEditorSettings().allowedMimeTypes;

	originalValidateMimeTypeForUser( file, wpAllowedMimeTypes );
	originalValidateMimeType( file, allowedTypes );
}
