import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';

import {
	blobToFile,
	getCanvasBlob,
	getExtensionFromMimeType,
} from '@mexp/media-utils';

// Setting worker path to worker bundle.
GlobalWorkerOptions.workerSrc =
	'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.269/build/pdf.worker.js';

export async function getImageFromPdf(
	url: string,
	basename: string,
	type: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/webp',
	quality = 0.82
) {
	const pdf = await getDocument( url ).promise;
	const pdfPage = await pdf.getPage( 1 );

	// Display page on the existing canvas with 100% scale.
	const viewport = pdfPage.getViewport( { scale: 1.0 } );

	const canvas = document.createElement( 'canvas' );
	canvas.width = viewport.width;
	canvas.height = viewport.height;
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
