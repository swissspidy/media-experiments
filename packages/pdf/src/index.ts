import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';

// Setting worker path to worker bundle.
GlobalWorkerOptions.workerSrc = PDFJS_CDN_URL;

/**
 * Returns a Blob object from a canvas element.
 *
 * Simple, promise-ified version of `HTMLCanvasElement.toBlob()`.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob
 *
 * @param canvas  Canvas element
 * @param type    Desired image format.
 * @param quality Desired image quality.
 */
function getCanvasBlob(
	canvas: HTMLCanvasElement,
	type = 'image/jpeg',
	quality = 0.82
): Promise< Blob > {
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

/**
 * Returns an image file for a given PDF.
 *
 * @param url      PDF URL.
 * @param basename File base name to use for the thumbnail file.
 * @param type     Mime type to use for the image.
 * @param quality  Desired image quality.
 * @return Image file.
 */
export async function getImageFromPdf(
	url: string,
	basename: string,
	type: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/jpeg',
	quality = 0.82
): Promise< File > {
	const pdf = await getDocument( url ).promise;
	const pdfPage = await pdf.getPage( 1 );

	const viewport = pdfPage.getViewport( { scale: 1.5 } );

	const canvas = document.createElement( 'canvas' );

	// Default is 72DPI but WordPress defaults to 128DPI (see \WP_Image_Editor_Imagick::pdf_setup()).
	// Increase canvas dimensions to accommodate for that.
	// See https://github.com/mozilla/pdf.js/blob/29faa38dd78d319ac99ab35aed7e659f3b070f4f/docs/contents/examples/index.md#rendering-the-page
	const outputScale = 128 / 72;

	canvas.width = Math.floor( viewport.width * outputScale );
	canvas.height = Math.floor( viewport.height * outputScale );
	canvas.style.width = `${ Math.floor( viewport.width ) }px`;
	canvas.style.height = `${ Math.floor( viewport.height ) }px`;
	const ctx = canvas.getContext( '2d' );

	if ( ! ctx ) {
		throw new Error( 'Could not get context' );
	}

	await pdfPage.render( {
		canvasContext: ctx,
		transform: [ outputScale, 0, 0, outputScale, 0, 0 ],
		viewport,
	} ).promise;

	const blob = await getCanvasBlob( canvas, type, quality );
	const ext = blob.type.split( '/' )[ 1 ];

	return new File( [ blob ], `${ basename }.${ ext }`, { type: blob.type } );
}
