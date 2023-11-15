import { v4 as uuidv4 } from 'uuid';
import { __, sprintf } from '@wordpress/i18n';
import { dispatch } from '@wordpress/data';

import { store as uploadStore } from './store';
import type {
	AdditionalData,
	OnChangeHandler,
	OnErrorHandler,
} from './store/types';
import UploadError from './uploadError';
import { canTranscodeFile, getMimeTypesArray } from './utils';

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
	// List of allowed mime types and file extensions.
	wpAllowedMimeTypes?: Record< string, string > | null;
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
 *
 * @param args
 * @param args.allowedTypes
 * @param args.additionalData
 * @param args.filesList
 * @param args.maxUploadFileSize
 * @param args.onError
 * @param args.onFileChange
 * @param args.wpAllowedMimeTypes
 */
export function uploadMedia( {
	allowedTypes,
	additionalData = {},
	filesList,
	maxUploadFileSize,
	onError = noop,
	onFileChange,
	wpAllowedMimeTypes = null,
}: UploadMediaArgs ) {
	// Allowed type specified by consumer.
	const isAllowedType = ( fileType: string ) => {
		if ( ! allowedTypes ) {
			return true;
		}

		return allowedTypes.some( ( allowedType ) => {
			// If a complete mimetype is specified verify if it matches exactly the mime type of the file.
			if ( allowedType.includes( '/' ) ) {
				return allowedType === fileType;
			}
			// Otherwise a general mime type is used, and we should verify if the file mimetype starts with it.
			return fileType.startsWith( `${ allowedType }/` );
		} );
	};

	// Allowed types for the current WP_User.
	const allowedMimeTypesForUser = getMimeTypesArray( wpAllowedMimeTypes );
	const isAllowedMimeTypeForUser = ( fileType: string ) => {
		return allowedMimeTypesForUser.includes( fileType );
	};

	const validFiles = [];

	for ( const mediaFile of filesList ) {
		// Verify if user is allowed to upload this mime type.
		// Defer to the server when type not detected.
		if (
			allowedMimeTypesForUser &&
			mediaFile.type &&
			! isAllowedMimeTypeForUser( mediaFile.type ) &&
			! canTranscodeFile( mediaFile )
		) {
			onError(
				new UploadError( {
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
				} )
			);
			continue;
		}

		// Check if the block supports this mime type.
		// Defer to the server when type not detected.
		if ( mediaFile.type && ! isAllowedType( mediaFile.type ) ) {
			onError(
				new UploadError( {
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
				} )
			);
			continue;
		}

		// Verify if file is greater than the maximum file upload size allowed for the site.
		// TODO: Check if file can be compressed via FFmpeg
		if ( maxUploadFileSize && mediaFile.size > maxUploadFileSize ) {
			onError(
				new UploadError( {
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
				} )
			);
			continue;
		}

		// Don't allow empty files to be uploaded.
		if ( mediaFile.size <= 0 ) {
			onError(
				new UploadError( {
					code: 'EMPTY_FILE',
					message: sprintf(
						// translators: %s: file name.
						__( '%s: This file is empty.', 'media-experiments' ),
						mediaFile.name
					),
					file: mediaFile,
				} )
			);
			continue;
		}

		validFiles.push( mediaFile );
	}

	const batchId = uuidv4();

	// TODO: why exactly is HEIF slipping through here?

	for ( const file of validFiles ) {
		void dispatch( uploadStore ).addItem( {
			file,
			batchId,
			onChange: onFileChange,
			onError,
			additionalData: {
				...additionalData,
			},
		} );
	}
}
