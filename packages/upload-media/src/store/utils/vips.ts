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

// Whether `loadVips()` has resolved at least once, so `vipsTerminateWorker()`
// can skip fetching the ~3.8MB WASM chunk just to find there's no worker to
// terminate.
let vipsLoaded = false;

// The in-flight `vipsTerminateWorker()` call, if any. Terminating rejects
// any RPC still in flight on that worker, so every other vips call waits
// for a pending termination to finish first -- guaranteeing a newly started
// operation always gets a freshly (re)created worker rather than racing
// terminate() on the one about to be torn down.
let pendingTermination: Promise< void > | undefined;

async function loadVips() {
	if ( pendingTermination ) {
		await pendingTermination;
	}
	const vips = await import(
		/* webpackChunkName: 'vips' */ '@wordpress/vips/worker'
	);
	vipsLoaded = true;
	return vips;
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
	// covers `SharedArrayBuffer` (wasm-vips uses shared WebAssembly memory).
	// `Blob` rejects buffers backed by shared memory, so copy the bytes into a
	// plain, non-shared buffer via `Uint8Array#slice()` before creating it.
	const bytes = new Uint8Array( buffer ).slice();
	return new File( [ new Blob( [ bytes ], { type } ) ], name, { type } );
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

/**
 * Terminates the vips worker, if one exists, freeing its WASM memory.
 *
 * libvips' WASM linear memory only ever grows, never shrinks, for as long
 * as the worker lives, so a page that processes many images can end up
 * holding a large amount of memory even once fully idle. Call this once
 * the upload queue is empty; a later upload lazily spins the worker back
 * up on demand.
 */
export async function vipsTerminateWorker() {
	// Bail if vips was never loaded in the first place -- importing it here
	// would load ~3.8MB of WASM for nothing.
	if ( ! vipsLoaded ) {
		return;
	}

	// Already terminating (e.g. the queue emptied twice in quick
	// succession) -- join the existing call rather than start a second one.
	if ( pendingTermination ) {
		return pendingTermination;
	}

	// Import directly rather than via `loadVips()`, which would await
	// `pendingTermination` -- the very promise being assigned here.
	pendingTermination = ( async () => {
		const { terminateVipsWorker } = await import(
			/* webpackChunkName: 'vips' */ '@wordpress/vips/worker'
		);
		terminateVipsWorker();
	} )();

	try {
		await pendingTermination;
	} finally {
		pendingTermination = undefined;
	}
}
