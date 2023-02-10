import apiFetch from '@wordpress/api-fetch';

import { Attachment, RestAttachment } from './store/types';

/**
 * Upload a file to the server.
 *
 * @param file           Media File to Save.
 * @param additionalData Additional data to include in the request.
 *
 * @return The saved attachment.
 */
function createMediaFromFile(
	file: File,
	additionalData: Record<string, string | number> = {}
) {
	// Create upload payload.
	const data = new window.FormData();
	data.append('file', file, file.name || file.type.replace('/', '.'));
	if (additionalData) {
		Object.entries(additionalData).forEach(([key, value]) =>
			data.append(key, String(value))
		);
	}

	return apiFetch<RestAttachment>({
		path: '/wp/v2/media',
		body: data,
		method: 'POST',
	});
}

/**
 * Update an existing attachment on the server.
 *
 * @param id Attachment ID.
 * @param data Additional data to include in the request.
 *
 * @return Updated attachment
 */
export function updateMediaItem(
	id: RestAttachment['id'],
	data: Partial<RestAttachment>
) {
	return apiFetch<RestAttachment>({
		path: `/wp/v2/media/${id}`,
		data,
		method: 'POST',
	});
}

export async function uploadToServer(
	file: File,
	additionalData: Record<string, string | number> = {}
) {
	const savedMedia = await createMediaFromFile(file, additionalData);

	// TODO: Check if a poster happened to be uploaded on the server side already (check featured_media !== 0).
	// In that case there is no need for client-side generation.
	return {
		id: savedMedia.id,
		alt: savedMedia.alt_text,
		caption: savedMedia.caption?.raw ?? '',
		title: savedMedia.title.raw,
		url: savedMedia.source_url,
		mimeType: savedMedia.mime_type,
	} as Attachment;
}
