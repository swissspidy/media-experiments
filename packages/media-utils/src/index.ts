export function getMediaTypeFromMimeType( mimeType: string ) {
	if ( mimeType === 'application/pdf' ) {
		return 'pdf';
	}
	return mimeType.split( '/' )[ 0 ];
}

/**
 * Get the file extension for a given mime type.
 *
 * Good enough for the use case here, but ideally this
 * would come from a mime database.
 *
 * @param mimeType Mime type.
 * @return File extension.
 */
export function getExtensionFromMimeType( mimeType: string ) {
	// Verbose but readable.
	switch ( mimeType ) {
		case 'image/jpeg':
			return 'jpeg';
		case 'image/png':
			return 'png';
		case 'image/webp':
			return 'webp';
		default:
			return 'unknown';
	}
}

export function getFileBasename( name: string ) {
	return name.includes( '.' )
		? name.split( '.' ).slice( 0, -1 ).join( '.' )
		: name;
}

export function blobToFile( blob: Blob, filename: string, type: string ): File {
	return new File( [ blob ], filename, { type } );
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

export function getImageData( image: HTMLImageElement, width?: number ) {
	const canvas = document.createElement( 'canvas' );
	const desiredWidth = width || image.naturalWidth;
	const desiredHeight =
		( image.naturalHeight / image.naturalWidth ) * desiredWidth;
	canvas.width = desiredWidth;
	canvas.height = desiredHeight;

	const ctx = canvas.getContext( '2d' );

	// If the contextType doesn't match a possible drawing context,
	// or differs from the first contextType requested, null is returned.
	if ( ! ctx ) {
		throw new Error( 'Could not get context' );
	}

	ctx.drawImage( image, 0, 0, canvas.width, canvas.height );
	return ctx.getImageData( 0, 0, desiredWidth, desiredHeight );
}

export function getCanvasBlob(
	canvasEl: HTMLCanvasElement,
	type: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/jpeg',
	quality = 0.82
) {
	return new Promise< Blob >( ( resolve, reject ) => {
		canvasEl.toBlob(
			( blob ) =>
				blob
					? resolve( blob )
					: reject( new Error( 'Could not get canvas blob' ) ),
			type,
			quality
		);
	} );
}

export async function bufferToBlob(
	buffer: ArrayBuffer,
	width: number,
	height: number,
	type: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/jpeg',
	quality = 0.82
) {
	const canvas = document.createElement( 'canvas' );
	canvas.width = width;
	canvas.height = height;

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
