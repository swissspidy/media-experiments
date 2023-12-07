import type { DecodeResult } from 'libheif-js';

import {
	blobToFile,
	bufferToBlob,
	getExtensionFromMimeType,
	getFileBasename,
} from '@mexp/media-utils';

export function isHeifImage( buffer: ArrayBuffer ) {
	const fourCC = String.fromCharCode(
		...Array.from( new Uint8Array( buffer.slice( 8, 12 ) ) )
	);

	const validFourCC = [
		'mif1', // .heic / image/heif
		'msf1', // .heic / image/heif-sequence
		'heic', // .heic / image/heic
		'heix', // .heic / image/heic
		'hevc', // .heic / image/heic-sequence
		'hevx', // .heic / image/heic-sequence
	];

	return validFourCC.includes( fourCC );
}

function getDimensions( image: DecodeResult ) {
	const width = image.get_width();
	const height = image.get_height();

	return { width, height };
}

async function decodeImage( image: DecodeResult ) {
	const dimensions = getDimensions( image );
	const { width, height } = dimensions;

	return new Promise< ArrayBuffer >( ( resolve, reject ) => {
		image.display(
			{
				data: new Uint8ClampedArray( width * height * 4 ),
				width,
				height,
				colorSpace: 'srgb',
			},
			( result: ImageData | null ) => {
				if ( ! result ) {
					reject( new Error( 'HEIF processing error' ) );
				} else {
					resolve( result.data.buffer );
				}
			}
		);
	} );
}

export async function transcodeHeifImage(
	file: File,
	type?: 'image/jpeg' | 'image/png' | 'image/webp',
	quality?: number
) {
	const inputBuffer = await file.arrayBuffer();

	if ( ! isHeifImage( inputBuffer ) ) {
		throw new TypeError( 'Not a valid HEIF image 1' );
	}

	const decoder = new ( window.libheif().HeifDecoder )();

	// Image can have multiple frames, thus it's an array.
	// For now, only decode the first frame.

	const imagesArr = decoder.decode( new Uint8Array( inputBuffer ) );

	if ( ! imagesArr.length ) {
		throw new TypeError( 'Not a valid HEIF image' );
	}

	const resultBuffer = await decodeImage( imagesArr[ 0 ] );
	const dimensions = getDimensions( imagesArr[ 0 ] );

	let blob = await bufferToBlob(
		resultBuffer,
		dimensions.width,
		dimensions.height,
		type,
		quality
	);

	// Safari does not support WebP and falls back to PNG.
	// Use JPEG instead of PNG in that case.
	if ( type === 'image/webp' && blob.type !== 'image/webp' ) {
		blob = await bufferToBlob(
			resultBuffer,
			dimensions.width,
			dimensions.height,
			'image/jpeg',
			quality
		);
	}

	if ( ! blob ) {
		throw new Error( 'HEIF processing error' );
	}

	return blobToFile(
		blob,
		`${ getFileBasename( file.name ) }.${ getExtensionFromMimeType(
			blob.type
		) }`,
		blob.type
	);
}
