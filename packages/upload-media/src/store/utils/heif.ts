/**
 * External dependencies
 */
import { createWorkerFactory, type WorkerCreator } from '@shopify/web-worker';

/**
 * Internal dependencies
 */
import { getFileBasename } from '../../utils';

let heifWorker:
	| ReturnType< WorkerCreator< typeof import('@mexp/heif') > >
	| undefined;

function getHeifWorker() {
	if ( heifWorker !== undefined ) {
		return heifWorker;
	}

	const createWorker = createWorkerFactory(
		() => import( /* webpackChunkName: 'heif' */ '@mexp/heif' )
	);
	heifWorker = createWorker();

	return heifWorker;
}

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
	const { buffer, width, height } = await getHeifWorker().transcodeHeifImage(
		await file.arrayBuffer()
	);

	const blob = await bufferToBlob( buffer, width, height, type, quality );

	const basename = getFileBasename( file.name );
	const ext = type.split( '/' )[ 1 ];

	return new File( [ blob ], `${ basename }.${ ext }`, { type } );
}
