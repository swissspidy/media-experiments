import {
	blobToFile,
	getCanvasBlob,
	getExtensionFromMimeType,
	getFileBasename,
	getFileExtension,
	getMimeTypeFromExtension,
	ImageFile,
	preloadImage,
} from '@mexp/media-utils';

import {
	MEDIA_TRANSCODING_MAX_FILE_SIZE,
	TRANSCODABLE_MIME_TYPES,
} from './constants';
import { UploadError } from './uploadError';
import type { Attachment, ImageSizeCrop, RestAttachment } from './store/types';

// TODO: Make work for HEIF, GIF and audio as well.
export function canTranscodeFile( file: File ) {
	return (
		window?.crossOriginIsolated &&
		TRANSCODABLE_MIME_TYPES.includes( file.type ) &&
		file.size <= MEDIA_TRANSCODING_MAX_FILE_SIZE
	);
}

/**
 * Browsers may use unexpected mime types, and they differ from browser to browser.
 * This function computes a flexible array of mime types from the mime type structured provided by the server.
 * Converts { jpg|jpeg|jpe: "image/jpeg" } into [ "image/jpeg", "image/jpg", "image/jpeg", "image/jpe" ]
 * The computation of this array instead of directly using the object,
 * solves the problem in chrome where mp3 files have audio/mp3 as mime type instead of audio/mpeg.
 * https://bugs.chromium.org/p/chromium/issues/detail?id=227004
 *
 * @param {?Object} wpMimeTypesObject Mime type object received from the server.
 *                                    Extensions are keys separated by '|' and values are mime types associated with an extension.
 *
 * @return {?Array} An array of mime types.
 */
export function getMimeTypesArray(
	wpMimeTypesObject?: Record< string, string > | null
) {
	if ( ! wpMimeTypesObject ) {
		return [];
	}
	return Object.entries( wpMimeTypesObject )
		.map( ( [ extensionsString, mime ] ) => {
			const [ type ] = mime.split( '/' );
			const extensions = extensionsString.split( '|' );
			return [
				mime,
				...extensions.map(
					( extension ) => `${ type }/${ extension }`
				),
			];
		} )
		.flat();
}

/**
 * Returns the file name including extension from a URL.
 *
 * @param url File URL.
 * @return File name.
 */
export function getFileNameFromUrl( url: string ) {
	const tail = url.split( '/' ).at( -1 );
	if ( ! tail ) {
		return 'unnamed'; // TODO: Better fallback needed?
	}
	return tail.split( /[#?]/ ).at( 0 ) ?? tail;
}

export async function fetchRemoteFile( url: string, nameOverride?: string ) {
	const response = await fetch( url );
	if ( ! response.ok ) {
		throw new Error( `Could not fetch remote file: ${ response.status }` );
	}

	const name = nameOverride || getFileNameFromUrl( url );
	const blob = await response.blob();

	// Fallback if blob.type is an empty string, e.g. when server does not return correct Content-Type.
	const mimeType =
		blob.type || getMimeTypeFromExtension( getFileExtension( name ) || '' );

	const file = blobToFile( blob, name, mimeType || '' );

	if ( ! mimeType ) {
		throw new UploadError( {
			code: 'FETCH_REMOTE_FILE_ERROR',
			message: 'File could not be uploaded',
			file,
		} );
	}

	return file;
}

function preloadVideoMetadata( src: string ) {
	const video = document.createElement( 'video' );
	video.muted = true;
	video.crossOrigin = 'anonymous';
	video.preload = 'metadata';

	return new Promise< HTMLVideoElement >( ( resolve, reject ) => {
		video.addEventListener( 'loadedmetadata', () => resolve( video ) );
		video.addEventListener( 'error', reject );

		video.src = src;
	} );
}

async function preloadVideo( src: string ) {
	const video = await preloadVideoMetadata( src );

	return new Promise< HTMLVideoElement >( ( resolve, reject ) => {
		video.addEventListener( 'canplay', () => resolve( video ), {
			once: true,
		} );
		video.addEventListener( 'error', reject );

		video.preload = 'auto';
	} );
}

function seekVideo( video: HTMLVideoElement, offset = 0.99 ) {
	if ( video.currentTime === offset ) {
		return Promise.resolve();
	}

	return new Promise< void >( ( resolve, reject ) => {
		// If the seek takes longer 3 seconds, guess it timed out and error out.
		video.addEventListener( 'seeking', ( evt ) => {
			const wait = setTimeout( () => {
				clearTimeout( wait );
				reject( evt );
			}, 3000 /* 3 seconds */ );
		} );
		video.addEventListener( 'error', reject );
		video.addEventListener( 'seeked', () => resolve(), { once: true } );

		video.currentTime = offset;
	} );
}

/**
 * Determines whether a video element has audio tracks.
 *
 * @param src Video URL.
 * @return Whether the video has audio or not.
 */
export async function videoHasAudio( src: string ) {
	const video = await preloadVideo( src );
	await seekVideo( video );
	return Boolean(
		video.mozHasAudio ||
			Boolean( video.webkitAudioDecodedByteCount ) ||
			( video.audioTracks ? video.audioTracks.length > 0 : false )
	);
}

export async function getPosterFromVideo(
	src: string,
	basename: string,
	type: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/jpeg',
	quality = 0.82
) {
	let blob = await getFirstFrameOfVideo( src, type, quality );

	// Safari does not support WebP and falls back to PNG.
	// Use JPEG instead of PNG in that case.
	if ( type === 'image/webp' && blob.type !== 'image/webp' ) {
		blob = await getFirstFrameOfVideo( src, 'image/jpeg', quality );
	}

	return blobToFile(
		blob,
		`${ basename }.${ getExtensionFromMimeType( blob.type ) }`,
		blob.type
	);
}

export async function getFirstFrameOfVideo(
	src: string,
	type: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/jpeg',
	quality = 0.82
) {
	const video = await preloadVideo( src );
	await seekVideo( video );
	return getImageFromVideo( video, type, quality );
}

export function getImageFromVideo(
	video: HTMLVideoElement,
	type: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/jpeg',
	quality = 0.82
) {
	const canvas = document.createElement( 'canvas' );
	canvas.width = video.videoWidth;
	canvas.height = video.videoHeight;

	const ctx = canvas.getContext( '2d' );

	// If the contextType doesn't match a possible drawing context,
	// or differs from the first contextType requested, null is returned.
	if ( ! ctx ) {
		throw new Error( 'Could not get context' );
	}

	ctx.drawImage( video, 0, 0, canvas.width, canvas.height );
	return getCanvasBlob( canvas, type, quality );
}

/**
 * Whether an image is an animated GIF.
 *
 * Loosely based on https://www.npmjs.com/package/animated-gif-detector (MIT-compatible ISC license)
 *
 * See http://www.matthewflickinger.com/lab/whatsinagif/bits_and_bytes.asp for how GIFs are structured.
 *
 * @param buffer The GIF ArrayBuffer instance.
 * @return Whether this is an animated GIF or not.
 */
export function isAnimatedGif( buffer: ArrayBuffer ) {
	// See http://www.matthewflickinger.com/lab/whatsinagif/bits_and_bytes.asp.
	const BLOCK_TERMINATOR = 0x00;
	const EXTENSION_INTRODUCER = 0x21;
	const GRAPHIC_CONTROL_LABEL = 0xf9;

	const arr = new Uint8Array( buffer );
	let frames = 0;

	// Make sure it's a GIF and skip early if it isn't.
	// 47="G", 49="I", 46="F", 38="8"
	if (
		arr[ 0 ] !== 0x47 ||
		arr[ 1 ] !== 0x49 ||
		arr[ 2 ] !== 0x46 ||
		arr[ 3 ] !== 0x38
	) {
		return false;
	}

	for ( let i = 4; i < arr.length; i++ ) {
		// We reached a new block, increase frame count.
		if (
			arr[ i ] === BLOCK_TERMINATOR &&
			arr[ i + 1 ] === EXTENSION_INTRODUCER &&
			arr[ i + 2 ] === GRAPHIC_CONTROL_LABEL
		) {
			frames++;
		}
	}

	return frames > 1;
}

export async function convertImageFormat(
	file: File,
	type: 'image/jpeg' | 'image/png' | 'image/webp',
	quality = 0.82
) {
	const url = URL.createObjectURL( file );

	try {
		const img = await preloadImage( url );

		const canvas = new OffscreenCanvas(
			img.naturalWidth,
			img.naturalHeight
		);

		const ctx = canvas.getContext( '2d' );

		// If the contextType doesn't match a possible drawing context,
		// or differs from the first contextType requested, null is returned.
		if ( ! ctx ) {
			throw new Error( 'Could not get context' );
		}

		ctx.drawImage( img, 0, 0, canvas.width, canvas.height );

		const blob = await getCanvasBlob( canvas, type, quality );

		return blobToFile(
			blob,
			`${ getFileBasename( file.name ) }.${ getExtensionFromMimeType(
				blob.type
			) }`,
			blob.type
		);

		// No catch, as error handling should be done in prepareItem()
		// or wherever this is called from.
	} finally {
		URL.revokeObjectURL( url );
	}
}

function isFileTypeSupported(
	type: string
): type is 'image/jpeg' | 'image/png' | 'image/webp' {
	return [ 'image/jpeg', 'image/png', 'image/webp' ].includes( type );
}

export async function compressImage( file: File, quality = 0.82 ) {
	if ( ! isFileTypeSupported( file.type ) ) {
		throw new Error( 'Unsupported file type' );
	}
	return convertImageFormat( file, file.type, quality );
}

/**
 * Resizes and crops an image using createImageBitmap and canvas.
 *
 * @param file      File.
 * @param resize    Resize options.
 * @param addSuffix Whether to add a dimensions suffix to the resized file's name.
 */
export async function resizeImage(
	file: File,
	resize: ImageSizeCrop,
	addSuffix: boolean
) {
	const url = URL.createObjectURL( file );

	try {
		const img = await preloadImage( url );
		const { naturalWidth: width, naturalHeight: height } = img;

		// If resize.height is zero.
		resize.height = resize.height || ( height / width ) * resize.width;

		let resizeWidth: number | undefined;
		let resizeHeight: number | undefined;

		let expectedWidth = resize.width;
		let expectedHeight = resize.height;

		let bitmap;

		if ( ! resize.crop ) {
			if ( width < height ) {
				if ( resize.width <= resize.height ) {
					if ( resize.height > height ) {
						resizeWidth = resize.width;
					} else {
						resizeHeight = resize.height;
					}
				} else if ( resize.width > width ) {
					resizeHeight = resize.height;
				} else {
					resizeWidth = resize.width;
				}
			} else if ( resize.width <= resize.height ) {
				resizeWidth = resize.width > width ? width : resize.width;
				if ( resize.width > width ) {
					resizeHeight = resize.height;
				} else {
					resizeWidth = resize.width;
				}
			} else if ( resize.height > height ) {
				resizeWidth = resize.width;
			} else {
				resizeHeight = resize.height;
			}

			if ( resizeWidth ) {
				expectedWidth = resizeWidth;
				expectedHeight = ( height / width ) * resizeWidth;
			} else if ( resizeHeight ) {
				expectedHeight = resizeHeight;
				expectedWidth = ( width / height ) * resizeHeight;
			}

			bitmap = await createImageBitmap( img, 0, 0, width, height, {
				resizeWidth,
				resizeHeight,
				resizeQuality: 'pixelated', // Not currently supported in Firefox.
				premultiplyAlpha: 'none',
				colorSpaceConversion: 'none',
			} );
		} else {
			// These are equal.
			if ( true === resize.crop ) {
				resize.crop = [ 'center', 'center' ];
			}

			// First resize, then do the cropping.
			// This allows operating on the second bitmap with the correct dimensions.

			if ( width < height || ! resize.height ) {
				resizeWidth = resize.width;
			} else {
				resizeHeight = resize.height;
			}

			bitmap = await createImageBitmap( img, 0, 0, width, height, {
				resizeWidth,
				resizeHeight,
				resizeQuality: 'high', // Not currently supported in Firefox.
				premultiplyAlpha: 'none',
				colorSpaceConversion: 'none',
			} );

			let sx = 0;
			let sy = 0;
			const sw = resize.width;
			const sh = resize.height;

			if ( 'center' === resize.crop[ 0 ] ) {
				sx = ( bitmap.width - resize.width ) / 2;
			} else if ( 'right' === resize.crop[ 0 ] ) {
				sx = bitmap.width - resize.width;
			}

			if ( 'center' === resize.crop[ 1 ] ) {
				sy = ( bitmap.height - resize.height ) / 2;
			} else if ( 'bottom' === resize.crop[ 1 ] ) {
				sy = bitmap.height - resize.height;
			}

			bitmap = await createImageBitmap( bitmap, sx, sy, sw, sh, {
				resizeQuality: 'pixelated', // Not currently supported in Firefox.
				premultiplyAlpha: 'none',
				colorSpaceConversion: 'none',
			} );
		}

		// Using expected width/height over bitmap.width / bitmap.height to fix 1px rounding errors.
		expectedWidth = Math.round( Number( expectedWidth.toFixed( 1 ) ) );
		expectedHeight = Math.round( Number( expectedHeight.toFixed( 1 ) ) );

		const canvas = new OffscreenCanvas( expectedWidth, expectedHeight );
		const ctx = canvas.getContext( '2d' );

		// If the contextType doesn't match a possible drawing context,
		// or differs from the first contextType requested, null is returned.
		if ( ! ctx ) {
			throw new Error( 'Could not get context' );
		}

		ctx.drawImage( bitmap, 0, 0, expectedWidth, expectedHeight );

		const blob = await getCanvasBlob( canvas, file.type );

		let fileName = file.name;

		if ( addSuffix && ( width > canvas.width || height > canvas.height ) ) {
			const basename = getFileBasename( file.name );
			fileName = file.name.replace(
				basename,
				`${ basename }-${ canvas.width }x${ canvas.height }`
			);
		}

		const newFile = blobToFile( blob, fileName, blob.type );

		return new ImageFile(
			newFile,
			canvas.width,
			canvas.height,
			width,
			height
		);

		// No catch, as error handling should be done in prepareItem()
		// or wherever this is called from.
	} finally {
		URL.revokeObjectURL( url );
	}
}

export function transformAttachment( attachment: RestAttachment ): Attachment {
	return {
		id: attachment.id,
		alt: attachment.alt_text,
		caption: attachment.caption?.raw ?? '',
		title: attachment.title.raw,
		url: attachment.source_url,
		mimeType: attachment.mime_type,
		blurHash: attachment.mexp_blurhash,
		dominantColor: attachment.mexp_dominant_color,
		posterId: attachment.featured_media,
		missingImageSizes: attachment.missing_image_sizes,
		fileName: attachment.mexp_filename,
	} as Attachment;
}
