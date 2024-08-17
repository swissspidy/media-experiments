/**
 * External dependencies
 */
import {
	uploadMedia as originalUploadMedia,
	validateFileSize,
	validateMimeType,
	validateMimeTypeForUser,
} from '@mexp/media-utils';

/**
 * WordPress dependencies
 */
import { select } from '@wordpress/data';
import { store as editorStore } from '@wordpress/editor';

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
export function editorUploadMedia( {
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
export function editorValidateFileSize( file: File ) {
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
export function editorValidateMimeType( file: File, allowedTypes?: string[] ) {
	const { getEditorSettings } = select( editorStore );
	const wpAllowedMimeTypes = getEditorSettings().allowedMimeTypes;

	validateMimeTypeForUser( file, wpAllowedMimeTypes );
	validateMimeType( file, allowedTypes );
}
