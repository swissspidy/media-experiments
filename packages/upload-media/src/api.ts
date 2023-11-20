import apiFetch from '@wordpress/api-fetch';

import type {
	Attachment,
	CreateRestAttachment,
	RestAttachment,
	SideloadAdditionalData,
} from './store/types';

export async function uploadToServer(
	file: File,
	additionalData: CreateRestAttachment = {}
) {
	const savedMedia = await createMediaFromFile( file, additionalData );

	// TODO: Check if a poster happened to be uploaded on the server side already (check featured_media !== 0).
	// In that case there is no need for client-side generation.
	return {
		id: savedMedia.id,
		alt: savedMedia.alt_text,
		caption: savedMedia.caption?.raw ?? '',
		title: savedMedia.title.raw,
		url: savedMedia.source_url,
		mimeType: savedMedia.mime_type,
		blurHash: savedMedia.meta.mexp_blurhash,
		dominantColor: savedMedia.meta.mexp_dominant_color,
		posterId: savedMedia.featured_media,
		missingImageSizes: savedMedia.missing_image_sizes,
		fileName: savedMedia.mexp_filename,
	} as Attachment;
}

/**
 * Upload a file to the server.
 *
 * @param file           Media File to Save.
 * @param additionalData Additional data to include in the request.
 *
 * @return The saved attachment.
 */
async function createMediaFromFile(
	file: File,
	additionalData: CreateRestAttachment = {}
) {
	// Create upload payload.
	const data = new FormData();
	data.append( 'file', file, file.name || file.type.replace( '/', '.' ) );
	Object.entries( additionalData ).forEach( ( [ key, value ] ) =>
		flattenFormData(
			data,
			key,
			value as string | Record< string, string > | undefined
		)
	);

	return apiFetch< RestAttachment >( {
		path: '/wp/v2/media',
		body: data,
		method: 'POST',
	} );
}

/**
 * Uploads a file to the server without creating an attachment.
 *
 * @param file           Media File to Save.
 * @param additionalData Additional data to include in the request.
 *
 * @return The saved attachment.
 */
export async function sideloadFile(
	file: File,
	additionalData: SideloadAdditionalData = {}
) {
	// Create upload payload.
	const data = new FormData();
	data.append( 'file', file, file.name || file.type.replace( '/', '.' ) );
	Object.entries( additionalData ).forEach( ( [ key, value ] ) =>
		flattenFormData(
			data,
			key,
			value as string | Record< string, string > | undefined
		)
	);

	return apiFetch< unknown >( {
		path: '/wp/v2/media/sideload',
		body: data,
		method: 'POST',
	} );
}

/**
 * Update an existing attachment in the database.
 *
 * @param id   Attachment ID.
 * @param data Attachment data.
 */
export function updateMediaItem(
	id: RestAttachment[ 'id' ],
	data: Partial< RestAttachment >
) {
	return apiFetch< RestAttachment >( {
		path: `/wp/v2/media/${ id }`,
		data,
		method: 'POST',
	} );
}

/**
 * Recursively flatten data passed to form data, to allow using multi-level objects.
 *
 * @param {FormData}      formData Form data object.
 * @param {string}        key      Key to amend to form data object
 * @param {string|Object} data     Data to be amended to form data.
 */
function flattenFormData(
	formData: FormData,
	key: string,
	data: string | undefined | Record< string, string >
) {
	if ( typeof data === 'object' ) {
		for ( const name in data ) {
			if ( Object.prototype.hasOwnProperty.call( data, name ) ) {
				flattenFormData(
					formData,
					`${ key }[${ name }]`,
					data[ name ]
				);
			}
		}
	} else if ( data !== undefined ) {
		formData.append( key, data );
	}
}
