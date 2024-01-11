import mime from 'mime/lite';

export { ImageFile } from './imageFile';

export function getMediaTypeFromMimeType( mimeType: string ) {
	if ( mimeType === 'application/pdf' ) {
		return 'pdf';
	}
	return mimeType.split( '/' )[ 0 ];
}

/**
 * Get the file extension for a given mime type.
 *
 * @param mimeType Mime type.
 * @return File extension.
 */
export function getExtensionFromMimeType( mimeType: string ): string | null {
	return mime.getExtension( mimeType );
}

/**
 * Get the mime type for a given file extension.
 *
 * @param ext File extension.
 * @return Mime type.
 */
export function getMimeTypeFromExtension( ext: string ): string | null {
	return mime.getType( ext );
}

/**
 * Returns file basename without extension.
 *
 * @param name File name.
 */
export function getFileBasename( name: string ) {
	return name.includes( '.' )
		? name.split( '.' ).slice( 0, -1 ).join( '.' )
		: name;
}

/**
 * Returns the file extension from a given URL.
 *
 * @param file File URL.
 * @return File extension.
 */
export function getFileExtension( file: string ) {
	return file.includes( '.' ) ? file.split( '.' ).pop() || null : null;
}

export function blobToFile( blob: Blob, filename: string, type: string ): File {
	return new File( [ blob ], filename, { type } );
}

export function renameFile( file: File, name: string ) {
	return new File( [ file ], name, {
		type: file.type,
		lastModified: file.lastModified,
	} );
}

export function cloneFile( file: File ) {
	return renameFile( file, file.name );
}

export function preloadImage( src: string, width?: number, height?: number ) {
	return new Promise< HTMLImageElement >( ( resolve, reject ) => {
		// If no width or height are provided, set them to undefined
		// so that is preloaded with its full dimensions.
		// Avoids creating an image with 0x0 dimensions.
		const image = new Image(
			width ? Number( width ) : undefined,
			height ? Number( height ) : undefined
		);
		image.addEventListener( 'load', () => resolve( image ) );
		image.addEventListener( 'error', ( error ) => reject( error ) );
		image.decoding = 'async';
		image.crossOrigin = 'anonymous';

		image.src = src;
	} );
}

export function getCanvasBlob(
	canvas: HTMLCanvasElement | OffscreenCanvas,
	type = 'image/jpeg',
	quality = 0.82
) {
	if ( 'toBlob' in canvas ) {
		return new Promise< Blob >( ( resolve, reject ) => {
			canvas.toBlob(
				( blob ) =>
					blob
						? resolve( blob )
						: reject( new Error( 'Could not get canvas blob' ) ),
				type,
				quality
			);
		} );
	}
	// OffscreenCanvas.
	return canvas.convertToBlob( {
		type,
		quality,
	} );
}

export async function bufferToBlob(
	buffer: ArrayBuffer,
	width: number,
	height: number,
	type: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/jpeg',
	quality = 0.82
) {
	const canvas = new OffscreenCanvas( width, height );

	const ctx = canvas.getContext( '2d' );

	if ( ! ctx ) {
		throw new Error( 'Could not get context' );
	}

	const imageData = new ImageData(
		new Uint8ClampedArray( buffer ),
		width,
		height
	);

	ctx.putImageData( imageData, 0, 0 );

	return getCanvasBlob( canvas, type, quality );
}
