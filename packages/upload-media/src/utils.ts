/**
 * External dependencies
 */
import mime from 'mime/lite';

/**
 * WordPress dependencies
 */
import { getFilename } from '@wordpress/url';
import { __, _x, sprintf } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import {
	WASM_MEMORY_LIMIT,
	FFMPEG_SUPPORTED_AUDIO_VIDEO_MIME_TYPES,
} from './constants';
import { UploadError } from './upload-error';

/**
 * Renames a given file and returns a new file.
 *
 * Copies over the last modified time.
 *
 * @param file File object.
 * @param name File name.
 * @return Renamed file object.
 */
export function renameFile( file: File, name: string ): File {
	return new File( [ file ], name, {
		type: file.type,
		lastModified: file.lastModified,
	} );
}

/**
 * Clones a given file object.
 *
 * @param file File object.
 * @return New file object.
 */
export function cloneFile( file: File ): File {
	return renameFile( file, file.name );
}

/**
 * Returns the file extension from a given file name or URL.
 *
 * @param file File URL.
 * @return File extension or null if it does not have one.
 */
export function getFileExtension( file: string ): string | null {
	return file.includes( '.' ) ? file.split( '.' ).pop() || null : null;
}

/**
 * Returns file basename without extension.
 *
 * For example, turns "my-awesome-file.jpeg" into "my-awesome-file".
 *
 * @param name File name.
 * @return File basename.
 */
export function getFileBasename( name: string ): string {
	return name.includes( '.' )
		? name.split( '.' ).slice( 0, -1 ).join( '.' )
		: name;
}

/**
 * Determines whether a video file can be processed in the browser.
 *
 * Takes into account a hardcoded list of mime types,
 * and WebAssembly memory limits.
 *
 * @param file File object.
 */
export function canProcessWithFFmpeg( file: File ) {
	return (
		FFMPEG_SUPPORTED_AUDIO_VIDEO_MIME_TYPES.includes( file.type ) &&
		file.size <= WASM_MEMORY_LIMIT
	);
}

/**
 * Returns the file name including extension from a URL.
 *
 * @param url File URL.
 * @return File name.
 */
export function getFileNameFromUrl( url: string ) {
	return (
		getFilename( url ) || _x( 'unnamed', 'file name', 'media-experiments' )
	);
}

/**
 * Fetches a remote file and returns a File instance.
 *
 * @param url          URL.
 * @param nameOverride File name to use, instead of deriving it from the URL.
 */
export async function fetchFile( url: string, nameOverride?: string ) {
	const response = await fetch( url );
	if ( ! response.ok ) {
		throw new Error( `Could not fetch remote file: ${ response.status }` );
	}

	const name = nameOverride || getFileNameFromUrl( url );
	const blob = await response.blob();

	const ext = getFileExtension( name );
	const guessedMimeType = ext ? mime.getType( ext ) : '';

	let type = '';

	// blob.type can be an empty string when server does not return a correct Content-Type.
	if ( blob.type && blob.type !== 'application/octet-stream' ) {
		type = blob.type;
	} else if ( guessedMimeType ) {
		type = guessedMimeType;
	}

	const file = new File( [ blob ], name, { type } );

	if ( ! guessedMimeType ) {
		throw new UploadError( {
			code: 'FETCH_REMOTE_FILE_ERROR',
			message: 'Remote file could not be downloaded',
			file,
		} );
	}

	return file;
}

/**
 * Preloads a video's metadata.
 *
 * @param src Video URL.
 */
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

/**
 * Preloads a video.
 *
 * @param src Video URL.
 */
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

/**
 * Seeks a video to a new time.
 *
 * Note: browsers don't support very accurate seeking
 * to offer protection against timing attacks and fingerprinting
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/currentTime
 *
 * @param video  Video element.
 * @param offset Desired playback time.
 */
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

/**
 * Returns a File containing the poster image of a given video.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob
 *
 * @param src      Video URL.
 * @param basename The video's base filename.
 * @param type     Desired output mime type, as supported by HTMLCanvasElement.toBlob().
 * @param quality  Desired image quality.
 */
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

	const ext = blob.type.split( '/' )[ 1 ];

	return new File( [ blob ], `${ basename }.${ ext }`, { type: blob.type } );
}

/**
 * Returns the earliest possible still frame from a video.
 *
 * Preloads the video and seeks to a very early offset before attempting
 * to capture the frame.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob
 *
 * @param src     Video URL.
 * @param type    Desired output mime type, as supported by HTMLCanvasElement.toBlob().
 * @param quality Desired image quality.
 */
export async function getFirstFrameOfVideo(
	src: string,
	type: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/jpeg',
	quality = 0.82
) {
	const video = await preloadVideo( src );
	await seekVideo( video );
	return getImageFromVideo( video, type, quality );
}

/**
 * Returns a still image from a video element.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob
 *
 * @param video   HTML video element.
 * @param type    Desired output mime type, as supported by HTMLCanvasElement.toBlob().
 * @param quality Desired image quality.
 */
export function getImageFromVideo(
	video: HTMLVideoElement,
	type: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/jpeg',
	quality = 0.82
) {
	const canvas = new OffscreenCanvas( video.videoWidth, video.videoHeight );

	const ctx = canvas.getContext( '2d' );

	// If the contextType doesn't match a possible drawing context,
	// or differs from the first contextType requested, null is returned.
	if ( ! ctx ) {
		throw new Error( 'Could not get context' );
	}

	ctx.drawImage( video, 0, 0, canvas.width, canvas.height );
	return canvas.convertToBlob( { type, quality } );
}

/**
 * Determines whether an image is an animated GIF.
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

/**
 * Determines whether a given image is an HEIF image.
 *
 * @param buffer File array buffer.
 * @return Whether it is an HEIF image.
 */
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

/**
 * Verifies if the caller supports this mime type.
 *
 * @param file         File object.
 * @param allowedTypes List of allowed mime types.
 */
export function validateMimeType( file: File, allowedTypes?: string[] ) {
	if ( ! allowedTypes ) {
		return;
	}

	// Allowed type specified by consumer.
	const isAllowedType = allowedTypes.some( ( allowedType ) => {
		// If a complete mimetype is specified verify if it matches exactly the mime type of the file.
		if ( allowedType.includes( '/' ) ) {
			return allowedType === file.type;
		}
		// Otherwise a general mime type is used, and we should verify if the file mimetype starts with it.
		return file.type.startsWith( `${ allowedType }/` );
	} );

	if ( file.type && ! isAllowedType ) {
		throw new UploadError( {
			code: 'MIME_TYPE_NOT_SUPPORTED',
			message: sprintf(
				// translators: %s: file name.
				__(
					'%s: Sorry, this file type is not supported here.',
					'media-experiments'
				),
				file.name
			),
			file,
		} );
	}
}
