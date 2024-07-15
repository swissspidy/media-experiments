import apiFetch from '@wordpress/api-fetch';

import { flattenFormData } from './flattenFormData';
import { transformAttachment } from './transformAttachment';
import type { CreateRestAttachment, RestAttachment } from './types';

export async function uploadToServer(
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

	return transformAttachment(
		await apiFetch< RestAttachment >( {
			path: '/wp/v2/media',
			body: data,
			method: 'POST',
			signal,
		} )
	);
}
