import {
	blobToFile,
	getExtensionFromMimeType,
	getFileBasename,
} from '@mexp/media-utils';

import type { ImageSizeCrop } from './types';

async function getVips() {
	return window.Vips( {
		// Disable dynamic modules, it doesn't work when wasm-vips is served from a CDN
		// https://github.com/kleisauke/wasm-vips/issues/35
		dynamicLibraries: [],
		// https://github.com/kleisauke/wasm-vips/issues/12#issuecomment-1067001784
		// https://github.com/kleisauke/wasm-vips/blob/789363e5b54d677b109bcdaf8353d283d81a8ee3/src/locatefile-cors-pre.js#L4
		// @ts-ignore
		workaroundCors: true,
	} );
}

/**
 * Transcodes an image using vips.
 *
 * @param file Original file object.
 * @return Processed file object.
 */
export async function convertImageToJpeg( file: File ) {
	const vips = await getVips();
	const image = vips.Image.newFromBuffer( await file.arrayBuffer() );
	const outBuffer = image.writeToBuffer( '.jpeg', { Q: 75 } );

	const fileName = `${ getFileBasename( file.name ) }.jpeg`;
	return blobToFile(
		new Blob( [ outBuffer ], { type: 'image/jpeg' } ),
		fileName,
		'image/jpeg'
	);
}

/**
 * Resizes an image using vips.
 *
 * @param file   Original file object.
 * @param resize
 * @return Processed file object.
 */
export async function resizeImage( file: File, resize: ImageSizeCrop ) {
	const vips = await getVips();
	const options: Record< string, unknown > = {};
	if ( resize.height ) {
		options.height = resize.height;
	}
	if ( true === resize.crop ) {
		options.crop = 'centre';
	}

	let image;

	if ( ! resize.crop || true === resize.crop ) {
		image = vips.Image.thumbnailBuffer( await file.arrayBuffer(),
			resize.width, options );
	} else {
		image = vips.Image.newFromBuffer( await file.arrayBuffer() );

		const { width, height } = image;

		let left = 0;
		if ( 'center' === resize.crop[ 0 ] ) {
			left = width / 2;
		} else if ( 'right' === resize.crop[ 0 ] ) {
			left = width - resize.width;
		}

		let top = 0;
		if ( 'center' === resize.crop[ 1 ] ) {
			top = height / 2;
		} else if ( 'bottom' === resize.crop[ 1 ] ) {
			top = height - resize.height;
		}

		image = image.crop( left, top, resize.width, resize.height );
	}

	const ext = getExtensionFromMimeType( file.type );
	const outBuffer = image.writeToBuffer( `.${ ext }` );

	const fileName = `${ getFileBasename( file.name ) }-${ image.width }x${
		image.height
	}.${ ext }`;

	return blobToFile(
		new Blob( [ outBuffer ], { type: file.type } ),
		fileName,
		file.type
	);
}
