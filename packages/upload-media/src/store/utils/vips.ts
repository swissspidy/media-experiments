/**
 * Internal dependencies
 */
import { ImageFile } from '../../image-file';
import { getFileBasename } from '../../utils';
import type { ImageSizeCrop, QueueItemId } from '../types';

/*
 * `@wordpress/vips/worker` inlines the libvips WASM binary, so it is loaded on
 * demand to keep it out of the main bundle. It spawns and manages its own
 * worker; all this module does is adapt between `File` objects and the
 * `ArrayBuffer`s the package works with.
 */
function loadVips() {
	return import( /* webpackChunkName: 'vips' */ '@wordpress/vips/worker' );
}

/*
 * `@wordpress/vips` strips metadata by default, matching what WordPress does
 * server-side. This plugin has always preserved it, so opt out explicitly
 * rather than change behaviour as a side effect of moving to the package.
 */
const KEEP_METADATA = { stripMeta: false } as const;

function toFile(
	buffer: ArrayBuffer | ArrayBufferLike,
	name: string,
	type: string
) {
	// `@wordpress/vips` widens its return type to `ArrayBufferLike`, which also
	// covers `SharedArrayBuffer`. Only a plain `ArrayBuffer` is a valid BlobPart.
	return new File( [ new Blob( [ buffer as ArrayBuffer ], { type } ) ], name, {
		type,
	} );
}

export async function vipsConvertImageFormat(
	id: QueueItemId,
	file: File,
	type:
		| 'image/jpeg'
		| 'image/png'
		| 'image/webp'
		| 'image/avif'
		| 'image/gif',
	quality: number,
	interlaced?: boolean
) {
	const { vipsConvertImageFormat: convertImageFormat } = await loadVips();
	const buffer = await convertImageFormat(
		id,
		await file.arrayBuffer(),
		file.type,
		type,
		{ quality, interlaced, ...KEEP_METADATA }
	);
	const ext = type.split( '/' )[ 1 ];
	const fileName = `${ getFileBasename( file.name ) }.${ ext }`;
	return toFile( buffer, fileName, type );
}

/**
 * Converts a HEIF/HEIC image to a browser-friendly format.
 *
 * libvips is built with HEIF support, so this replaces the separate
 * libheif-based decoder this plugin used to ship.
 *
 * @param id      Queue item ID.
 * @param file    HEIF file.
 * @param type    Desired output mime type.
 * @param quality Desired quality.
 */
export async function vipsTranscodeHeifImage(
	id: QueueItemId,
	file: File,
	type: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/jpeg',
	quality = 0.82
) {
	const { vipsConvertImageFormat: convertImageFormat } = await loadVips();
	const buffer = await convertImageFormat(
		id,
		await file.arrayBuffer(),
		file.type || 'image/heic',
		type,
		{ quality, ...KEEP_METADATA }
	);
	const ext = type.split( '/' )[ 1 ];
	const fileName = `${ getFileBasename( file.name ) }.${ ext }`;
	return toFile( buffer, fileName, type );
}

export async function vipsCompressImage(
	id: QueueItemId,
	file: File,
	quality: number,
	interlaced?: boolean
) {
	const { vipsCompressImage: compressImage } = await loadVips();
	const buffer = await compressImage(
		id,
		await file.arrayBuffer(),
		file.type,
		{
			quality,
			interlaced,
			...KEEP_METADATA,
		}
	);
	return toFile( buffer, file.name, file.type );
}

export async function vipsHasTransparency( url: string ) {
	const { vipsHasTransparency: hasTransparency } = await loadVips();
	return hasTransparency( await ( await fetch( url ) ).arrayBuffer() );
}

export async function vipsResizeImage(
	id: QueueItemId,
	file: File,
	resize: ImageSizeCrop,
	smartCrop: boolean,
	addSuffix: boolean
) {
	const { vipsResizeImage: resizeImage } = await loadVips();
	const { buffer, width, height, originalWidth, originalHeight } =
		await resizeImage( id, await file.arrayBuffer(), file.type, resize, {
			smartCrop,
			...KEEP_METADATA,
		} );

	let fileName = file.name;

	if ( addSuffix && ( originalWidth > width || originalHeight > height ) ) {
		const basename = getFileBasename( file.name );
		fileName = file.name.replace(
			basename,
			`${ basename }-${ width }x${ height }`
		);
	}

	return new ImageFile(
		toFile( buffer, fileName, file.type ),
		width,
		height,
		originalWidth,
		originalHeight
	);
}

/**
 * Cancels all ongoing image operations for the given item.
 *
 * @param id Queue item ID to cancel operations for.
 */
export async function vipsCancelOperations( id: QueueItemId ) {
	const { vipsCancelOperations: cancelOperations } = await loadVips();
	return cancelOperations( id );
}
