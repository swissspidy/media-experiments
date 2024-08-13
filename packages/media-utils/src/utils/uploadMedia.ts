/**
 * WordPress dependencies
 */
import { __, sprintf } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import type {
	AdditionalData,
	OnChangeHandler,
	OnErrorHandler,
	OnSuccessHandler,
} from './types';
import { uploadToServer } from './uploadToServer';
import { validateMimeType } from './validateMimeType';
import { validateMimeTypeForUser } from './validateMimeTypeForUser';
import { validateFileSize } from './validateFileSize';
import { UploadError } from './uploadError';

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
	// Function called once a file has completely finished uploading, including thumbnails.
	onSuccess?: OnSuccessHandler;
	// List of allowed mime types and file extensions.
	wpAllowedMimeTypes?: Record< string, string > | null;
	// Abort signal.
	signal?: AbortSignal;
}

/**
 * Upload a media file when the file upload button is activated
 * or when adding a file to the editor via drag & drop.
 *
 * Performs some client-side file processing before eventually
 * uploading the media to WordPress.
 *
 * Similar to the mediaUpload() function from `@wordpress/editor`.
 *
 * @param $0                    Parameters object passed to the function.
 * @param $0.allowedTypes       Array with the types of media that can be uploaded, if unset all types are allowed.
 * @param $0.additionalData     Additional data to include in the request.
 * @param $0.filesList          List of files.
 * @param $0.maxUploadFileSize  Maximum upload size in bytes allowed for the site.
 * @param $0.onError            Function called when an error happens.
 * @param $0.onFileChange       Function called each time a file or a temporary representation of the file is available.
 * @param $0.wpAllowedMimeTypes List of allowed mime types and file extensions.
 * @param $0.signal             Abort signal.
 */
export function uploadMedia( {
	wpAllowedMimeTypes,
	allowedTypes,
	additionalData = {},
	filesList,
	maxUploadFileSize,
	onError = noop,
	onFileChange,
	signal,
}: UploadMediaArgs ) {
	const validFiles = [];

	for ( const mediaFile of filesList ) {
		// Verify if user is allowed to upload this mime type.
		// Defer to the server when type not detected.
		try {
			validateMimeTypeForUser( mediaFile, wpAllowedMimeTypes );
		} catch ( error: unknown ) {
			onError( error as Error );
			continue;
		}

		// Check if the caller (e.g. a block) supports this mime type.
		// Defer to the server when type not detected.
		try {
			validateMimeType( mediaFile, allowedTypes );
		} catch ( error: unknown ) {
			onError( error as Error );
			continue;
		}

		// Verify if file is greater than the maximum file upload size allowed for the site.
		try {
			validateFileSize( mediaFile, maxUploadFileSize );
		} catch ( error: unknown ) {
			onError( error as Error );
			continue;
		}

		validFiles.push( mediaFile );
	}

	validFiles.map( async ( file ) => {
		try {
			const attachment = await uploadToServer(
				file,
				additionalData,
				signal
			);
			onFileChange?.( [ attachment ] );
		} catch ( error ) {
			let message;
			if ( error instanceof Error ) {
				message = error.message;
			} else {
				message = sprintf(
					// translators: %s: file name
					__(
						'Error while uploading file %s to the media library.',
						'media-experiments'
					),
					file.name
				);
			}
			onError(
				new UploadError( {
					code: 'GENERAL',
					message,
					file,
				} )
			);
		}
	} );
}
