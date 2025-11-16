/**
 * External dependencies
 */
import { createWorkerFactory, type WorkerCreator } from '@shopify/web-worker';

/**
 * Internal dependencies
 */
import { ImageFile } from '../../image-file';
import { getFileBasename } from '../../utils';
import type { ImageSizeCrop } from '../types';

let canvasWorker:
	| ReturnType< WorkerCreator< typeof import('../workers/canvas') > >
	| undefined;

function getCanvasWorker() {
	if ( canvasWorker !== undefined ) {
		return canvasWorker;
	}

	const createWorker = createWorkerFactory(
		() => import( /* webpackChunkName: 'canvas' */ '../workers/canvas' )
	);
	canvasWorker = createWorker();

	return canvasWorker;
}

export async function compressImage( file: File, quality = 0.82 ) {
	return new File(
		[
			new Blob(
				[
					await getCanvasWorker().compressImage(
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
					await getCanvasWorker().convertImageFormat(
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
	const result = await getCanvasWorker().resizeImage(
		await file.arrayBuffer(),
		file.type,
		resize
	);
	const basename = getFileBasename( file.name );
	const ext = file.type.split( '/' )[ 1 ];

	let fileName = `${ basename }.${ ext }`;

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
