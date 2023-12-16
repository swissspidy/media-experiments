import type { DecodeResult } from 'libheif-js';
const libheif = require( 'libheif-js/wasm-bundle' );

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

export async function transcodeHeifImage( buffer: ArrayBuffer ) {
	if ( ! isHeifImage( buffer ) ) {
		throw new TypeError( 'Not a valid HEIF image' );
	}

	const decoder = new libheif.HeifDecoder();

	const imagesArr = decoder.decode( new Uint8Array( buffer ) );

	if ( ! imagesArr.length ) {
		throw new TypeError( 'Not a valid HEIF image' );
	}

	// Image can have multiple frames, thus it's an array.
	// For now, only decode the first frame.
	const image = imagesArr[ 0 ];
	const outBuffer = await decodeImage( image );
	const { width, height } = getDimensions( image );

	return {
		buffer: outBuffer,
		width,
		height,
	};
}
