import apiFetch from '@wordpress/api-fetch';

import type {
	Attachment,
	CreateRestAttachment,
	RestAttachment,
} from './store/types';

/**
 * Recursively flatten data passed to form data, to allow using multi-level objects.
 *
 * @param {FormData} formData Form data object.
 * @param {string} key Key to amend to form data object
 * @param {string|Object} data Data to be amended to form data.
 */
function flattenFormData(formData, key, data) {
	if (typeof data === 'object') {
		for (const name in data) {
			if (Object.prototype.hasOwnProperty.call(data, name)) {
				flattenFormData(formData, `${key}[${name}]`, data[name]);
			}
		}
	} else {
		formData.append(key, data);
	}
}

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
	additionalData: CreateRestAttachment = {}
) {
	// Create upload payload.
	const data = new window.FormData();
	data.append('file', file, file.name || file.type.replace('/', '.'));
	Object.entries(additionalData).forEach(([key, value]) =>
		flattenFormData(data, key, value)
	);

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
	data: CreateRestAttachment
) {
	return apiFetch<RestAttachment>({
		path: `/wp/v2/media/${id}`,
		data,
		method: 'POST',
	});
}

export async function uploadToServer(
	file: File,
	additionalData: CreateRestAttachment = {}
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
