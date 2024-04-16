import apiFetch from '@wordpress/api-fetch';

import type {
	CreateRestAttachment,
	CreateSideloadFile,
	RestAttachment,
} from './store/types';
import { transformAttachment } from './utils';

export async function uploadToServer(
	file: File,
	additionalData: CreateRestAttachment = {},
	signal?: AbortSignal
) {
	const savedMedia = await createMediaFromFile(
		file,
		additionalData,
		signal
	);
	return transformAttachment( savedMedia );
}

/**
 * Upload a file to the server.
 *
 * @param file           Media File to Save.
 * @param additionalData Additional data to include in the request.
 * @param signal         Abort signal.
 *
 * @return The saved attachment.
 */
async function createMediaFromFile(
	file: File,
	additionalData: CreateRestAttachment = {},
	signal?: AbortSignal
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
		signal,
	} );
}

/**
 * Uploads a file to the server without creating an attachment.
 *
 * @param file           Media File to Save.
 * @param attachmentId   Parent attachment ID.
 * @param additionalData Additional data to include in the request.
 * @param signal         Abort signal.
 *
 * @return The saved attachment.
 */
export async function sideloadFile(
	file: File,
	attachmentId: RestAttachment[ 'id' ],
	additionalData: CreateSideloadFile = {},
	signal?: AbortSignal
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

	return transformAttachment(
		await apiFetch< RestAttachment >( {
			path: `/wp/v2/media/${ attachmentId }/sideload`,
			body: data,
			method: 'POST',
			signal,
		} )
	);
}

/**
 * Update an existing attachment in the database.
 *
 * @param id     Attachment ID.
 * @param data   Attachment data.
 * @param signal Abort signal.
 */
export function updateMediaItem(
	id: RestAttachment[ 'id' ],
	data: Partial< RestAttachment >,
	signal?: AbortSignal
) {
	return apiFetch< RestAttachment >( {
		path: `/wp/v2/media/${ id }`,
		data,
		method: 'POST',
		signal,
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
