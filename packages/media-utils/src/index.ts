import mime from 'mime/lite';

export { ImageFile } from './imageFile';

/**
 * Returns the media type from a given mime type.
 *
 * @param mimeType Mime type.
 * @return Media type.
 *
 * @example
 * ```js
 * import { getMediaTypeFromMimeType } from '@mexp/media-utils';
 *
 * getMediaTypeFromMimeType( 'image/jpeg' ) // Returns 'image'
 * getMediaTypeFromMimeType( 'video/mpeg' ) // Returns 'video'
 * getMediaTypeFromMimeType( 'audio/mpeg' ) // Returns 'audio'
 * getMediaTypeFromMimeType( 'application/pdf' ) // Returns 'pdf'
 * ```
 */
export function getMediaTypeFromMimeType( mimeType: string ): string {
	if ( mimeType === 'application/pdf' ) {
		return 'pdf';
	}
	return mimeType.split( '/' )[ 0 ];
}

/**
 * Returns the file extension for a given mime type.
 *
 * @param mimeType Mime type.
 * @return File extension or null if it could not be found.
 *
 * @example
 * ```js
 * import { getExtensionFromMimeType } from '@mexp/media-utils';
 *
 * getExtensionFromMimeType( 'image/jpeg' ) // Returns '.jpeg'
 * getExtensionFromMimeType( 'video/mp4' ) // Returns '.mp4'
 * getExtensionFromMimeType( 'audio/mp3' ) // Returns '.mp3'
 * getExtensionFromMimeType( 'application/pdf' ) // Returns '.pdf'
 * ```
 */
export function getExtensionFromMimeType( mimeType: string ): string | null {
	return mime.getExtension( mimeType );
}

/**
 * Get the mime type for a given file extension.
 *
 * @param ext File extension.
 * @return Mime type or null if it could not be found.
 *
 * @example
 * ```js
 * import { getMimeTypeFromExtension } from '@mexp/media-utils';
 *
 * getMimeTypeFromExtension( '.jpeg' ) // Returns 'image/jpeg'
 * getMimeTypeFromExtension( '.mp4' ) // Returns 'video/mp4'
 * getMimeTypeFromExtension( '.mp3' ) // Returns 'video/mp3'
 * getMimeTypeFromExtension( '.pdf' ) // Returns 'application/pdf'
 * ```
 */
export function getMimeTypeFromExtension( ext: string ): string | null {
	return mime.getType( ext );
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
 * Returns the file extension from a given file name or URL.
 *
 * @param file File URL.
 * @return File extension or null if it does not have one.
 */
export function getFileExtension( file: string ): string | null {
	return file.includes( '.' ) ? file.split( '.' ).pop() || null : null;
}

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
 * Preloads a given image using the `Image()` constructor.
 *
 * Useful for further processing of the image, like saving it
 * or extracting its dominant color.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/Image
 *
 * @param src    Image URL.
 * @param width  Desired width.
 * @param height Desired height.
 */
export function preloadImage(
	src: string,
	width?: number,
	height?: number
): Promise< HTMLImageElement > {
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

