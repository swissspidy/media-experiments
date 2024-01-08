import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';

import {
	blobToFile,
	getCanvasBlob,
	getExtensionFromMimeType,
} from '@mexp/media-utils';

// Setting worker path to worker bundle.
GlobalWorkerOptions.workerSrc = PDFJS_CDN_URL;

export async function getImageFromPdf(
	url: string,
	basename: string,
	type: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/jpeg',
	quality = 0.82
) {
	const pdf = await getDocument( url ).promise;
	const pdfPage = await pdf.getPage( 1 );

	// Display page on the existing canvas with 100% scale.
	const viewport = pdfPage.getViewport( { scale: 1.0 } );

	const canvas = document.createElement( 'canvas' );

	// Default is 72DPI but WordPress defaults to 128DPI (see \WP_Image_Editor_Imagick::pdf_setup()).
	// Increase canvas dimensions to accommodate for that.
	const outputScale = 128 / 72;

	canvas.width = Math.floor( viewport.width * outputScale );
	canvas.height = Math.floor( viewport.height * outputScale );
	canvas.style.width = Math.floor( viewport.width ) + 'px';
	canvas.style.height = Math.floor( viewport.height ) + 'px';
	const ctx = canvas.getContext( '2d' );

	if ( ! ctx ) {
		throw new Error( 'Could not get context' );
	}

	await pdfPage.render( {
		canvasContext: ctx,
		viewport,
	} ).promise;

	const blob = await getCanvasBlob( canvas, type, quality );

	return blobToFile(
		blob,
		`${ basename }.${ getExtensionFromMimeType( blob.type ) }`,
		blob.type
	);
}
