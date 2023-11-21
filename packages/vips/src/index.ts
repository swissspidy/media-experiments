import {
	blobToFile,
	getExtensionFromMimeType,
	getFileBasename,
} from '@mexp/media-utils';

async function getVips() {
	// Ignore reason: Types in the published package haven't been updated yet.
	// @ts-ignore
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

// Same type as in @mextp/upload-media
// TODO: Move to shared package?
type ImageSizeCrop = {
	width: number;
	height: number;
	crop?:
		| boolean
		| [ 'left' | 'center' | 'right', 'top' | 'center' | 'bottom' ];
};

/**
 * Resizes an image using vips.
 *
 * @param file   Original file object.
 * @param resize
 * @return Processed file object.
 */
export async function resizeImage( file: File, resize: ImageSizeCrop ) {
	const vips = await getVips();
	let image = vips.Image.newFromBuffer( await file.arrayBuffer() );

	const { width, height } = image;

	const options: Record< string, unknown > = {};
	if ( resize.height ) {
		options.height = resize.height;
	}

	if ( ! resize.crop ) {
		image = image.thumbnailImage( resize.width, options );
	} else if ( true === resize.crop ) {
		options.crop = 'centre';
		image = image.thumbnailImage( resize.width, options );
	} else {
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
