import { dispatch, select, subscribe } from '@wordpress/data';
import { store as blockEditorStore } from '@wordpress/block-editor';
import { store as editorStore } from '@wordpress/editor';

import {
	uploadMedia as originalUploadMedia,
	sideloadMedia as originalSideloadMedia,
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
 * @param args
 * @param args.allowedTypes
 * @param args.additionalData
 * @param args.filesList
 * @param args.maxUploadFileSize
 * @param args.onError
 * @param args.onFileChange
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
 * Upload a media file when the file upload button is activated
 * or when adding a file to the editor via drag & drop.
 *
 * This function is intended to eventually live
 * in the @wordpress/block-editor package, allowing
 * to perform the client-side file processing before eventually
 * uploading the media to WordPress.
 *
 * @param args
 * @param args.allowedTypes
 * @param args.additionalData
 * @param args.filesList
 * @param args.maxUploadFileSize
 * @param args.onError
 * @param args.onFileChange
 */
function blockEditorUploadMedia( {
	// allowedTypes,
	additionalData = {},
	filesList,
	// maxUploadFileSize,
	onError = noop,
	onFileChange,
}: Parameters< typeof originalUploadMedia >[ 0 ] & {
	onError?: ( message: string ) => void;
} ) {
	void dispatch( uploadStore ).addItems( {
		files: filesList,
		onChange: onFileChange,
		onError: ( { message }: Error ) => onError( message ),
		additionalData,
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
		select( blockEditorStore ).getSettings().mediaUpload ===
		blockEditorUploadMedia
	) {
		return;
	}

	// Make the upload queue aware of the function for uploading to the server.
	void dispatch( uploadStore ).updateSettings( {
		mediaUpload: editorUploadMedia,
		mediaSideload: originalSideloadMedia,
	} );

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
