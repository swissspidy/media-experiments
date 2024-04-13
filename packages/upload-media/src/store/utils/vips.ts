import { createWorkerFactory } from '@shopify/web-worker';

import {
	blobToFile,
	getExtensionFromMimeType,
	getFileBasename,
	ImageFile,
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
		file.type,
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

export async function vipsHasTransparency( url: string ) {
	return vipsWorker.hasTransparency(
		await ( await fetch( url ) ).arrayBuffer()
	);
}

export async function vipsResizeImage(
	file: File,
	resize: ImageSizeCrop,
	smartCrop: boolean,
	addSuffix: boolean
) {
	const { buffer, width, height, originalWidth, originalHeight } =
		await vipsWorker.resizeImage(
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
