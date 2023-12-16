import * as vips from '@mexp/vips';

import type { ImageSizeCrop } from '../store/types';

/**
 * Converts an image to a specific format.
 *
 * @param buffer  Image.
 * @param type    Mime type.
 * @param quality Image quality.
 * @return New image.
 */
export async function convertImageFormat(
	buffer: ArrayBuffer,
	type:
		| 'image/jpeg'
		| 'image/png'
		| 'image/webp'
		| 'image/avif'
		| 'image/gif',
	quality = 0.82
) {
	return vips.convertImageFormat( buffer, type, quality );
}

export async function compressImage(
	buffer: ArrayBuffer,
	type: string,
	quality = 0.82
) {
	return vips.compressImage( buffer, type, quality );
}

/**
 * Resizes an image using vips.
 *
 * @param buffer File buffer.
 * @param ext    File extension.
 * @param resize
 * @return Processed file object.
 */
export async function resizeImage(
	buffer: ArrayBuffer,
	ext: string,
	resize: ImageSizeCrop
) {
	return vips.resizeImage( buffer, ext, resize );
}
