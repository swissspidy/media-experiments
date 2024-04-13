const Vips = require( 'wasm-vips' );
import type VipsInstance from 'wasm-vips';

import { getExtensionFromMimeType } from '@mexp/media-utils';

import type {
	ImageSizeCrop,
	SaveOptions,
	ThumbnailOptions,
	LoadOptions,
} from './types';

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
			module.setDelayFunction( ( fn: () => void ) => {
				cleanup = fn;
			} );
		},
	} );

	return vipsInstance;
}

// TODO: Make this smarter.
function supportsQuality(
	type: string
): type is 'image/jpeg' | 'image/png' | 'image/webp' | 'image/avif' {
	return [ 'image/jpeg', 'image/png', 'image/webp', 'image/avif' ].includes(
		type
	);
}
// TODO: Make this smarter.
function supportsAnimation( type: string ): type is 'image/webp' | 'image/gif' {
	return [ 'image/webp', 'image/gif' ].includes( type );
}

export async function convertImageFormat(
	buffer: ArrayBuffer,
	type: string,
	quality = 0.82
) {
	const ext = getExtensionFromMimeType( type );

	if ( ! ext ) {
		throw new Error( 'Unsupported file type' );
	}

	let strOptions = '';
	const loadOptions: LoadOptions< typeof type > = {};

	// To ensure all frames are loaded in case the image is animated.
	if ( supportsAnimation( type ) ) {
		strOptions = '[n=-1]';
		( loadOptions as LoadOptions< typeof type > ).n = -1;
	}

	const vips = await getVips();
	const image = vips.Image.newFromBuffer( buffer, strOptions, loadOptions );

	const saveOptions: SaveOptions< typeof type > = {};

	if ( supportsQuality( type ) ) {
		saveOptions.Q = quality * 100;
	}

	const outBuffer = image.writeToBuffer( `.${ ext }`, saveOptions );
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
 * @param type      Mime type.
 * @param resize    Resize options.
 * @param smartCrop Whether to use smart cropping (i.e. saliency-aware).
 * @return Processed file object.
 */
export async function resizeImage(
	buffer: ArrayBuffer,
	type: string,
	resize: ImageSizeCrop,
	smartCrop = false
) {
	const ext = getExtensionFromMimeType( type );

	if ( ! ext ) {
		throw new Error( 'Unsupported file type' );
	}

	const vips = await getVips();
	const thumbnailOptions: ThumbnailOptions = {
		size: 'down',
	};

	let strOptions = '';
	const loadOptions: LoadOptions< typeof type > = {};

	// To ensure all frames are loaded in case the image is animated.
	if ( supportsAnimation( type ) ) {
		strOptions = '[n=-1]';
		( loadOptions as LoadOptions< typeof type > ).n = -1;
	}

	let image = vips.Image.newFromBuffer( buffer, strOptions, loadOptions );
	const { width } = image;

	const numberOfFrames = supportsAnimation( type )
		? image.getInt( 'n-pages' )
		: 1;
	const height = image.height / numberOfFrames;
	const isAnimated = numberOfFrames > 1;

	// To preserve all frames when cropping.
	if ( isAnimated ) {
		thumbnailOptions.option_string = '[n=-1]';
	}

	// If resize.height is zero.
	resize.height = resize.height || ( height / width ) * resize.width;

	let resizeWidth = resize.width;
	thumbnailOptions.height = resize.height;

	let newHeight;

	if ( ! resize.crop ) {
		image = vips.Image.thumbnailBuffer(
			buffer,
			resizeWidth,
			thumbnailOptions
		);

		newHeight = image.height / numberOfFrames;
	} else if ( true === resize.crop ) {
		thumbnailOptions.crop = smartCrop ? 'attention' : 'centre';

		image = vips.Image.thumbnailBuffer(
			buffer,
			resizeWidth,
			thumbnailOptions
		);

		newHeight = image.height;
	} else {
		// First resize, then do the cropping.
		// This allows operating on the second bitmap with the correct dimensions.

		if ( width < height ) {
			resizeWidth =
				resize.width >= resize.height
					? resize.width
					: ( width / height ) * resize.height;
			thumbnailOptions.height =
				resize.width >= resize.height
					? ( height / width ) * resizeWidth
					: resize.height;
		} else {
			resizeWidth =
				resize.width >= resize.height
					? ( width / height ) * resize.height
					: resize.width;
			thumbnailOptions.height =
				resize.width >= resize.height
					? resize.height
					: ( height / width ) * resizeWidth;
		}

		image = vips.Image.thumbnailBuffer(
			buffer,
			resizeWidth,
			thumbnailOptions
		);

		let left = 0;
		if ( 'center' === resize.crop[ 0 ] ) {
			left = ( image.width - resize.width ) / 2;
		} else if ( 'right' === resize.crop[ 0 ] ) {
			left = image.width - resize.width;
		}

		let top = 0;
		if ( 'center' === resize.crop[ 1 ] ) {
			top = ( image.height - resize.height ) / 2;
		} else if ( 'bottom' === resize.crop[ 1 ] ) {
			top = image.height - resize.height;
		}

		image = image.crop( left, top, resize.width, resize.height );

		newHeight = image.height;
	}

	// TODO: Allow passing quality?
	const saveOptions: SaveOptions< typeof type > = {};
	const outBuffer = image.writeToBuffer( `.${ ext }`, saveOptions );

	const result = {
		buffer: outBuffer.buffer,
		width: image.width,
		height: newHeight,
		originalWidth: width,
		originalHeight: height,
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
