/**
 * External dependencies
 */
import { uploadMedia as originalUploadMedia } from '@mexp/media-utils';
import { store as uploadStore } from '@mexp/upload-media';

/**
 * WordPress dependencies
 */
import { select, dispatch } from '@wordpress/data';
import { store as preferencesStore } from '@wordpress/preferences';

/**
 * Internal dependencies
 */
import { PREFERENCES_NAME } from '../../constants';
import { validateFileSize, validateMimeType } from './media-utils';

const noop = () => {};

/**
 * Upload a media file when the file upload button is activated
 * or when adding a file to the editor via drag & drop.
 *
 * @todo MERGE NOTE:
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
export function uploadMedia( {
	allowedTypes,
	additionalData = {},
	filesList,
	onError = noop,
	onFileChange,
	onSuccess,
	onBatchSuccess,
}: Parameters< typeof originalUploadMedia >[ 0 ] & {
	onError?: ( message: string ) => void;
	onSuccess?: Parameters< typeof originalUploadMedia >[ 0 ][ 'onFileChange' ];
	onBatchSuccess: () => void;
} ) {
	const convertUnsafe: boolean | undefined = select( preferencesStore ).get(
		PREFERENCES_NAME,
		'convertUnsafe'
	) as boolean | undefined;

	const validFiles = [];

	for ( const mediaFile of filesList ) {
		/*
		 Check if the caller (e.g. a block) supports this mime type.
		 Special case for file types such as HEIC which will be converted before upload anyway.
		 Another check will be done before upload.
		*/
		try {
			validateMimeType( mediaFile, allowedTypes );
		} catch ( error: unknown ) {
			if (
				! (
					mediaFile.type.startsWith( 'image/' ) &&
					! [
						'image/png',
						'image/gif',
						'image/jpeg',
						'image/webp',
						'image/avif',
						'image/heic',
						'image/heif',
					].includes( mediaFile.type ) &&
					convertUnsafe
				)
			) {
				onError( error as Error );
				continue;
			}
		}

		// Verify if file is greater than the maximum file upload size allowed for the site.
		// TODO: Consider removing, as file could potentially be compressed first.
		try {
			validateFileSize( mediaFile );
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
