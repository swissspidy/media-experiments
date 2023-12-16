import {
	blobToFile,
	getExtensionFromMimeType,
	getFileBasename,
} from '@mexp/media-utils';

import type { ImageSizeCrop } from './types';

let cleanup: () => void;

async function getVips() {
	return window.Vips( {
		// https://github.com/kleisauke/wasm-vips/issues/12#issuecomment-1067001784
		// https://github.com/kleisauke/wasm-vips/blob/789363e5b54d677b109bcdaf8353d283d81a8ee3/src/locatefile-cors-pre.js#L4
		// @ts-ignore
		workaroundCors: true,
		// locateFile: ( file ) =>
		// 	`https://cdn.jsdelivr.net/npm/wasm-vips@0.0.7/lib/${ file }`,
		preRun: ( module ) => {
			// https://github.com/kleisauke/wasm-vips/issues/13#issuecomment-1073246828
			module.setAutoDeleteLater( true );
			module.setDelayFunction( ( fn: () => void ) => ( cleanup = fn ) );
		},
	} );
}

export async function convertImageFormat(
	file: File,
	type:
		| 'image/jpeg'
		| 'image/png'
		| 'image/webp'
		| 'image/avif'
		| 'image/gif',
	quality = 0.82
) {
	const ext = getExtensionFromMimeType( type );
	const vips = await getVips();
	const image = vips.Image.newFromBuffer(
		new Uint8Array( await file.arrayBuffer() )
	);
	const outBuffer = image.writeToBuffer( `.${ ext }`, { Q: quality * 100 } );
	cleanup?.();

	const fileName = `${ getFileBasename( file.name ) }.${ ext }`;
	return blobToFile( new Blob( [ outBuffer ], { type } ), fileName, type );
}

function isFileTypeSupported(
	type: string
): type is
	| 'image/jpeg'
	| 'image/png'
	| 'image/webp'
	| 'image/avif'
	| 'image/gif' {
	return [
		'image/jpeg',
		'image/png',
		'image/webp',
		'image/avif',
		'image/gif',
	].includes( type );
}

export async function compressImage( file: File, quality = 0.82 ) {
	if ( ! isFileTypeSupported( file.type ) ) {
		throw new Error( 'Unsupported file type' );
	}
	return convertImageFormat( file, file.type, quality );
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
		image = vips.Image.thumbnailBuffer(
			new Uint8Array( await file.arrayBuffer() ),
			resize.width,
			options
		);
	} else {
		image = vips.Image.newFromBuffer(
			new Uint8Array( await file.arrayBuffer() )
		);

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

	// Only call after `image` is no longer being used.
	cleanup?.();

	return blobToFile(
		new Blob( [ outBuffer ], { type: file.type } ),
		fileName,
		file.type
	);
}
