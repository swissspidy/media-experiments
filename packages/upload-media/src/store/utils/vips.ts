import { createWorkerFactory } from '@shopify/web-worker';

import {
	blobToFile,
	getExtensionFromMimeType,
	getFileBasename,
	ImageFile,
} from '@mexp/media-utils';

import type { ImageSizeCrop, QueueItemId } from '../types';

const createVipsWorker = createWorkerFactory(
	() => import( /* webpackChunkName: 'vips' */ '@mexp/vips' )
);
const vipsWorker = createVipsWorker();

export async function vipsConvertImageFormat(
	id: QueueItemId,
	file: File,
	type:
		| 'image/jpeg'
		| 'image/png'
		| 'image/webp'
		| 'image/avif'
		| 'image/gif',
	quality: number
) {
	const buffer = await vipsWorker.convertImageFormat(
		id,
		await file.arrayBuffer(),
		file.type,
		type,
		quality
	);
	const ext = getExtensionFromMimeType( type );
	const fileName = `${ getFileBasename( file.name ) }.${ ext }`;
	return blobToFile( new Blob( [ buffer ], { type } ), fileName, type );
}

export async function vipsCompressImage(
	id: QueueItemId,
	file: File,
	quality: number
) {
	const buffer = await vipsWorker.compressImage(
		id,
		await file.arrayBuffer(),
		file.type,
		quality
	);
	return blobToFile(
		new Blob( [ buffer ], { type: file.type } ),
		file.name,
		file.type
	);
}

export async function vipsHasTransparency( url: string ) {
	return vipsWorker.hasTransparency(
		await ( await fetch( url ) ).arrayBuffer()
	);
}

export async function vipsResizeImage(
	id: QueueItemId,
	file: File,
	resize: ImageSizeCrop,
	smartCrop: boolean,
	addSuffix: boolean
) {
	const { buffer, width, height, originalWidth, originalHeight } =
		await vipsWorker.resizeImage(
			id,
			await file.arrayBuffer(),
			file.type,
			resize,
			smartCrop
		);

	let fileName = file.name;

	if ( addSuffix && ( originalWidth > width || originalHeight > height ) ) {
		const basename = getFileBasename( file.name );
		fileName = file.name.replace(
			basename,
			`${ basename }-${ width }x${ height }`
		);
	}

	return new ImageFile(
		blobToFile(
			new Blob( [ buffer ], { type: file.type } ),
			fileName,
			file.type
		),
		width,
		height,
		originalWidth,
		originalHeight
	);
}

/**
 * Cancels all ongoing image operations for the given item.
 *
 * @param id Queue item ID to cancel operations for.
 */
export async function vipsCancelOperations( id: QueueItemId ) {
	return vipsWorker.cancelOperations( id );
}
