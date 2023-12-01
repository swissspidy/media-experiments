import { encode } from 'blurhash';

export async function getBlurHash( url: string ) {
	const imgBlob = await ( await fetch( url ) ).blob();

	const bitmap = await createImageBitmap( imgBlob );
	const canvas = new OffscreenCanvas( 100, 100 );
	const ctx = canvas.getContext( '2d' );

	// If the contextType doesn't match a possible drawing context,
	// or differs from the first contextType requested, null is returned.
	if ( ! ctx ) {
		throw new Error( 'Could not get context' );
	}

	ctx.drawImage( bitmap, 0, 0, canvas.width, canvas.height );

	const imageData = ctx.getImageData( 0, 0, bitmap.width, bitmap.height );

	/// Scale down for performance reasons.
	// See https://github.com/woltapp/blurhash/blob/cb151cab5b7d9cd3eef624e12e30381c6d292f0d/Readme.md#L112

	return encode( imageData.data, imageData.width, imageData.height, 4, 4 );
}
