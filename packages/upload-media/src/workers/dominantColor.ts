import { FastAverageColor } from 'fast-average-color';

const isDevelopment =
	typeof process !== 'undefined' &&
	process.env &&
	process.env.NODE_ENV !== 'production';

/**
 * Gets dominant color from an image or video.
 *
 * @param url Image URL.
 * @return Hex string (e.g. #ff0000)
 */
export async function getDominantColor( url: string ) {
	const imgBlob = await ( await fetch( url ) ).blob();
	const bitmap = await createImageBitmap( imgBlob );

	const fac = new FastAverageColor();
	const { hex, error } = await fac.getColorAsync( bitmap, {
		defaultColor: [ 255, 255, 255, 255 ],
		// Errors that come up don't reject the promise, so error
		// logging has to be silenced with this option.
		silent: ! isDevelopment,
		crossOrigin: 'anonymous',
	} );

	if ( error ) {
		throw error;
	}

	return hex;
}
