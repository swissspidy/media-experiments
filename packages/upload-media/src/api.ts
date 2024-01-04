import apiFetch from '@wordpress/api-fetch';

import type {
	CreateRestAttachment,
	RestAttachment,
	SideloadAdditionalData,
} from './store/types';
import { transformAttachment } from './utils';

export async function uploadToServer(
	file: File,
	additionalData: CreateRestAttachment = {}
) {
	const savedMedia = await createMediaFromFile( file, additionalData );
	return transformAttachment( savedMedia );
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
	for ( const [ key, value ] of Object.entries( additionalData ) ) {
		flattenFormData(
			data,
			key,
			value as string | Record< string, string > | undefined
		);
	}

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
	for ( const [ key, value ] of Object.entries( additionalData ) ) {
		flattenFormData(
			data,
			key,
			value as string | Record< string, string > | undefined
		);
	}

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
