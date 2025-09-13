/**
 * External dependencies
 */
import libheif from 'libheif-js/libheif-wasm/libheif-bundle.js';

type DecodeResult = {
	img: {
		is_primary: boolean;
		thumbnails: number;
		width: number;
		height: number;
	} | null;
	get_width: () => number;
	get_height: () => number;
	is_primary: () => boolean;
	display: (
		base: ImageData,
		callback: ( result: ImageData | null ) => void
	) => void;
};

/**
 * Determines whether a given image is an HEIF image.
 *
 * @param buffer File array buffer.
 * @return Whether it is an HEIF image.
 */
export function isHeifImage( buffer: ArrayBuffer ): boolean {
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

/**
 * Returns dimensions from a decoder result as a simple object.
 *
 * @param image
 */
function getDimensions( image: DecodeResult ): {
	width: number;
	height: number;
} {
	const width = image.get_width();
	const height = image.get_height();

	return { width, height };
}

/**
 * Decodes a given HEIF image.
 *
 * @param image Decode result.
 */
function decodeImage( image: DecodeResult ) {
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
					resolve( result.data.buffer as ArrayBuffer );
				}
			}
		);
	} );
}

/**
 * Decodes a given HEIF file and returns the raw image data.
 *
 * @todo Find better function name?
 *
 * @param buffer File buffer.
 * @return Decoded image buffer plus dimensions.
 */
export async function transcodeHeifImage( buffer: ArrayBuffer ): Promise< {
	buffer: ArrayBuffer;
	width: number;
	height: number;
} > {
	if ( ! isHeifImage( buffer ) ) {
		throw new TypeError( 'Not a valid HEIF image' );
	}

	const decoder = new ( libheif().HeifDecoder )();

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
