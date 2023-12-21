import { createWorkerFactory } from '@shopify/web-worker';

import {
	blobToFile,
	getExtensionFromMimeType,
	getFileBasename,
} from '@mexp/media-utils';

import type { ImageSizeCrop } from '../types';

const createVipsWorker = createWorkerFactory(
	() => import( /* webpackChunkName: 'vips' */ '@mexp/vips' )
);
const vipsWorker = createVipsWorker();

export async function vipsConvertImageFormat(
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
		await file.arrayBuffer(),
		type,
		quality
	);
	const ext = getExtensionFromMimeType( type );
	const fileName = `${ getFileBasename( file.name ) }.${ ext }`;
	return blobToFile( new Blob( [ buffer ], { type } ), fileName, type );
}

export async function vipsCompressImage( file: File, quality: number ) {
	const buffer = await vipsWorker.compressImage(
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

export async function vipsResizeImage(
	file: File,
	resize: ImageSizeCrop,
	smartCrop: boolean
) {
	const ext = getExtensionFromMimeType( file.type );

	if ( ! ext ) {
		throw new Error( 'Unsupported file type' );
	}

	const { buffer, width, height } = await vipsWorker.resizeImage(
		await file.arrayBuffer(),
		ext,
		resize,
		smartCrop
	);
	const fileName = `${ getFileBasename(
		file.name
	) }-${ width }x${ height }.${ ext }`;

	return blobToFile(
		new Blob( [ buffer ], { type: file.type } ),
		fileName,
		file.type
	);
}
