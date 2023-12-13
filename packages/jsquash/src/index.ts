import { default as encodeJpeg, init as initJpeg } from '@jsquash/jpeg/encode';
import { default as encodeAvif, init as initAvif } from '@jsquash/avif/encode';
import {
	blobToFile,
	getFileBasename,
	getImageData,
	preloadImage,
} from '@mexp/media-utils';

/**
 * Convert an image to JPEG using jSquash.
 *
 * @param file Original file object.
 * @return Processed file object.
 */
export async function convertImageToJpeg( file: File ) {
	const url = URL.createObjectURL( file );

	try {
		const img = await preloadImage( url );
		const imageData = getImageData( img );

		const fileName = `${ getFileBasename( file.name ) }.jpeg`;

		await initJpeg( undefined, {
			locateFile: () =>
				'https://cdn.jsdelivr.net/npm/@jsquash/jpeg@1.2.0/codec/enc/mozjpeg_enc.wasm',
		} );

		const buffer = await encodeJpeg( imageData );

		return blobToFile(
			new Blob( [ buffer ], { type: 'image/jpeg' } ),
			fileName,
			'image/jpeg'
		);
	} finally {
		URL.revokeObjectURL( url );
	}
}

/**
 * Convert an image to JPEG using jSquash.
 *
 * @param file Original file object.
 * @return Processed file object.
 */
export async function convertImageToAvif( file: File ) {
	const url = URL.createObjectURL( file );

	try {
		const img = await preloadImage( url );
		const imageData = getImageData( img );

		const fileName = `${ getFileBasename( file.name ) }.avif`;

		await initAvif( undefined, {
			locateFile: () =>
				'https://cdn.jsdelivr.net/npm/@jsquash/avif@1.1.2/codec/enc/avif_enc.wasm',
		} );

		// See https://web.dev/articles/compress-images-avif
		// and https://github.com/jamsinclair/jSquash/blob/60a959a056d14ac18907fd186c572bf4400ff247/packages/avif/meta.ts#L20-L31
		const buffer = await encodeAvif( imageData, {
			cqLevel: 18,
			tune: 2, // ssim
			speed: 6,
		} );

		return blobToFile(
			new Blob( [ buffer ], { type: 'image/avif' } ),
			fileName,
			'image/avif'
		);
	} finally {
		URL.revokeObjectURL( url );
	}
}
