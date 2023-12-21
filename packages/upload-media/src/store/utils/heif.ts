import { createWorkerFactory } from '@shopify/web-worker';

import {
	blobToFile,
	bufferToBlob,
	getExtensionFromMimeType,
	getFileBasename,
} from '@mexp/media-utils';

const createHeifWorker = createWorkerFactory(
	() => import( /* webpackChunkName: 'heif' */ '@mexp/heif' )
);

const heifWorker = createHeifWorker();

export async function transcodeHeifImage(
	file: File,
	type: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/jpeg',
	quality = 0.82
) {
	const { buffer, width, height } = await heifWorker.transcodeHeifImage(
		await file.arrayBuffer()
	);

	const blob = await bufferToBlob( buffer, width, height, type, quality );

	return blobToFile(
		blob,
		`${ getFileBasename( file.name ) }.${ getExtensionFromMimeType(
			type
		) }`,
		type
	);
}

export async function isHeifImage( fileBuffer: ArrayBuffer ) {
	return heifWorker.isHeifImage( fileBuffer );
}
