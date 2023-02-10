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
	type: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/webp',
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
