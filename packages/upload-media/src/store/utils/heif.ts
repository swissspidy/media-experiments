import { createWorkerFactory } from '@shopify/web-worker';

import { getFileBasename } from '@mexp/media-utils';
import { getExtensionFromMimeType } from '@mexp/mime';

const createHeifWorker = createWorkerFactory(
	() => import( /* webpackChunkName: 'heif' */ '@mexp/heif' )
);

const heifWorker = createHeifWorker();

/**
 * Creates a Blob from a given ArrayBuffer.
 *
 * @param buffer  ArrayBuffer instance.
 * @param width   Desired width.
 * @param height  Desired height.
 * @param type    Desired mime type.
 * @param quality Desired image quality.
 */
async function bufferToBlob(
	buffer: ArrayBuffer,
	width: number,
	height: number,
	type: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/jpeg',
	quality = 0.82
): Promise< Blob > {
	const canvas = new OffscreenCanvas( width, height );

	const ctx = canvas.getContext( '2d' );

	if ( ! ctx ) {
		throw new Error( 'Could not get context' );
	}

	const imageData = new ImageData(
		new Uint8ClampedArray( buffer ),
		width,
		height
	);

	ctx.putImageData( imageData, 0, 0 );

	return canvas.convertToBlob( { type, quality } );
}

export async function transcodeHeifImage(
	file: File,
	type: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/jpeg',
	quality = 0.82
) {
	const { buffer, width, height } = await heifWorker.transcodeHeifImage(
		await file.arrayBuffer()
	);

	const blob = await bufferToBlob( buffer, width, height, type, quality );

	return new File(
		[ blob ],
		`${ getFileBasename( file.name ) }.${ getExtensionFromMimeType(
			type
		) }`,
		{ type }
	);
}
