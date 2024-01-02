const Vips = require( 'wasm-vips' );
import type VipsInstance from 'wasm-vips';

import { getExtensionFromMimeType } from '@mexp/media-utils';

import type { ImageSizeCrop, ThumbnailOptions } from './types';

type EmscriptenModule = {
	setAutoDeleteLater: ( autoDelete: boolean ) => void;
	setDelayFunction: ( fn: ( fn: () => void ) => void ) => void;
};

let cleanup: () => void;

let vipsInstance: typeof VipsInstance;

async function getVips(): Promise< typeof VipsInstance > {
	if ( vipsInstance ) {
		return vipsInstance;
	}

	const workerBlobUrl = URL.createObjectURL(
		await ( await fetch( `${ VIPS_CDN_URL }/vips.worker.js` ) ).blob()
	);

	vipsInstance = await Vips( {
		locateFile: ( fileName: string, scriptDirectory: string ) => {
			const url = scriptDirectory + fileName;
			if ( url.endsWith( '.worker.js' ) ) {
				return workerBlobUrl;
			}
			return `${ VIPS_CDN_URL }/${ fileName }`;
		},
		mainScriptUrlOrBlob: `${ VIPS_CDN_URL }/vips.js`,
		workaroundCors: true,
		preRun: ( module: EmscriptenModule ) => {
			// https://github.com/kleisauke/wasm-vips/issues/13#issuecomment-1073246828
			module.setAutoDeleteLater( true );
			module.setDelayFunction( ( fn: () => void ) => ( cleanup = fn ) );
		},
	} );

	return vipsInstance;
}

export async function convertImageFormat(
	buffer: ArrayBuffer,
	type:
		| 'image/jpeg'
		| 'image/png'
		| 'image/webp'
		| 'image/avif'
		| 'image/gif',
	quality = 0.82
) {
	const ext = getExtensionFromMimeType( type );

	if ( ! ext ) {
		throw new Error( 'Unsupported file type' );
	}

	const vips = await getVips();
	const image = vips.Image.newFromBuffer( buffer );
	const outBuffer = image.writeToBuffer( `.${ ext }`, { Q: quality * 100 } );
	const result = outBuffer.buffer;

	cleanup?.();

	return result;
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

export async function compressImage(
	buffer: ArrayBuffer,
	type: string,
	quality = 0.82
) {
	if ( ! isFileTypeSupported( type ) ) {
		throw new Error( 'Unsupported file type' );
	}
	return convertImageFormat( buffer, type, quality );
}

/**
 * Resizes an image using vips.
 *
 * @param buffer    Original file object.
 * @param ext       File extension.
 * @param resize    Resize options.
 * @param smartCrop Whether to use smart cropping (i.e. saliency-aware).
 * @return Processed file object.
 */
export async function resizeImage(
	buffer: ArrayBuffer,
	ext: string,
	resize: ImageSizeCrop,
	smartCrop: boolean = false
) {
	const vips = await getVips();
	const options: ThumbnailOptions = {
		size: 'down',
	};
	if ( resize.height ) {
		options.height = resize.height;
	}
	if ( true === resize.crop ) {
		options.crop = 'centre';
	}

	let image;

	if ( ! resize.crop || true === resize.crop ) {
		if ( smartCrop ) {
			options.crop = 'attention';
		}
		image = vips.Image.thumbnailBuffer( buffer, resize.width, options );
	} else {
		image = vips.Image.newFromBuffer( buffer );

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

	const outBuffer = image.writeToBuffer( `.${ ext }` );

	const result = {
		buffer: outBuffer.buffer,
		width: image.width,
		height: image.height,
	};

	// Only call after `image` is no longer being used.
	cleanup?.();

	return result;
}

/**
 * Determines whether an image has an alpha channel.
 *
 * @param buffer Original file object.
 * @return Whether the image has an alpha channel.
 */
export async function hasTransparency( buffer: ArrayBuffer ) {
	const vips = await getVips();
	const image = vips.Image.newFromBuffer( buffer );
	const hasAlpha = image.hasAlpha();

	cleanup?.();

	return hasAlpha;
}
