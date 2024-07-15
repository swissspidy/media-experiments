import { createWorkerFactory } from '@shopify/web-worker';

import {
	ImageFile,
	getExtensionFromMimeType,
	getFileBasename,
} from '@mexp/media-utils';

import type { ImageSizeCrop } from '../types';

const createCanvasWorker = createWorkerFactory(
	() => import( /* webpackChunkName: 'canvas' */ '../workers/canvas' )
);
const canvasWorker = createCanvasWorker();

export async function compressImage( file: File, quality = 0.82 ) {
	return new File(
		[
			new Blob(
				[
					await canvasWorker.compressImage(
						await file.arrayBuffer(),
						file.type,
						quality
					),
				],
				{ type: file.type }
			),
		],
		file.name,
		{ type: file.type }
	);
}

export async function convertImageFormat(
	file: File,
	mimeType: string,
	quality = 0.82
) {
	return new File(
		[
			new Blob(
				[
					await canvasWorker.convertImageFormat(
						await file.arrayBuffer(),
						file.type,
						mimeType,
						quality
					),
				],
				{ type: mimeType }
			),
		],
		file.name,
		{ type: mimeType }
	);
}

export async function resizeImage(
	file: File,
	resize: ImageSizeCrop,
	addSuffix: boolean
) {
	const result = await canvasWorker.resizeImage(
		await file.arrayBuffer(),
		file.type,
		resize
	);
	const basename = getFileBasename( file.name );
	let fileName = `${ basename }.${ getExtensionFromMimeType( file.type ) }`;

	if (
		addSuffix &&
		( result.originalWidth > result.width ||
			result.originalHeight > result.height )
	) {
		fileName = fileName.replace(
			basename,
			`${ basename }-${ result.width }x${ result.height }`
		);
	}

	return new ImageFile(
		new File(
			[ new Blob( [ result.buffer ], { type: file.type } ) ],
			fileName,
			{ type: file.type }
		),
		result.width,
		result.height,
		result.originalWidth,
		result.originalHeight
	);
}
