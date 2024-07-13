import { uploadMedia as originalUploadMedia } from '@mexp/upload-media';

import { dispatch, select, subscribe } from '@wordpress/data';
import { store as blockEditorStore } from '@wordpress/block-editor';
import { store as editorStore } from '@wordpress/editor';

type OnErrorHandler = ( message: string ) => void;

type UploadMediaArgs = Parameters< typeof originalUploadMedia >[ 0 ] & {
	onError?: OnErrorHandler;
};

const noop = () => {};

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

	void dispatch( blockEditorStore ).updateSettings( {
		mediaUpload: uploadMedia,
	} );

	// addFilter(
	// 	'editor.MediaUpload',
	// 	'media-experiments/replace-media-upload',
	// 	replaceMediaUpload
	// );
}, blockEditorStore );
