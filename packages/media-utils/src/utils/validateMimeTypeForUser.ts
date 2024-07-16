import { UploadError } from './uploadError';
import { __, sprintf } from '@wordpress/i18n';

/**
 * Verifies if the user is allowed to upload this mime type.
 *
 * @param file                    File object.
 * @param allowedMimeTypesForUser List of allowed mime types for the user.
 */
export function validateMimeTypeForUser(
	file: File,
	allowedMimeTypesForUser: string[]
) {
	const isAllowedMimeTypeForUser = allowedMimeTypesForUser.includes(
		file.type
	);

	if ( allowedMimeTypesForUser && file.type && ! isAllowedMimeTypeForUser ) {
		throw new UploadError( {
			code: 'MIME_TYPE_NOT_ALLOWED_FOR_USER',
			message: sprintf(
				// translators: %s: file name.
				__(
					'%s: Sorry, you are not allowed to upload this file type.',
					'media-experiments'
				),
				file.name
			),
			file,
		} );
	}
}
