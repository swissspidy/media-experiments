/**
 * External dependencies
 */
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';

/**
 * WordPress dependencies
 */
import { useEffect, useRef, useState } from '@wordpress/element';
import { Spinner } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import './pdf-viewer.css';

// Setting worker path to worker bundle.
// This is defined in webpack.config.js
GlobalWorkerOptions.workerSrc = PDFJS_CDN_URL;

interface PDFViewerProps {
	url: string;
	posterUrl?: string;
	className?: string;
}

export function PDFViewer( {
	url,
	posterUrl,
	className = '',
}: PDFViewerProps ) {
	const containerRef = useRef< HTMLDivElement >( null );
	const canvasRef = useRef< HTMLCanvasElement >( null );
	const [ isLoading, setIsLoading ] = useState( false );
	const [ isLoaded, setIsLoaded ] = useState( false );
	const [ error, setError ] = useState< string | null >( null );
	const [ pageNum, setPageNum ] = useState( 1 );
	const [ numPages, setNumPages ] = useState( 0 );
	const pdfDocRef = useRef< PDFDocumentProxy | null >( null );

	const renderPage = async ( pdf: PDFDocumentProxy, pageNumber: number ) => {
		if ( ! canvasRef.current ) {
			return;
		}

		try {
			const page: PDFPageProxy = await pdf.getPage( pageNumber );
			const viewport = page.getViewport( { scale: 1.5 } );

			const canvas = canvasRef.current;
			const context = canvas.getContext( '2d' );

			if ( ! context ) {
				throw new Error( 'Could not get canvas context' );
			}

			// Set canvas dimensions
			canvas.width = viewport.width;
			canvas.height = viewport.height;
			canvas.style.width = '100%';
			canvas.style.height = 'auto';

			// Render PDF page
			await page.render( {
				canvasContext: context,
				viewport,
			} ).promise;

			setIsLoaded( true );
			setIsLoading( false );
		} catch ( err ) {
			setError(
				err instanceof Error
					? err.message
					: __( 'Failed to render PDF page', 'media-experiments' )
			);
			setIsLoading( false );
		}
	};

	const loadPDF = async () => {
		if ( isLoaded || isLoading ) {
			return;
		}

		setIsLoading( true );
		setError( null );

		try {
			const pdf = await getDocument( url ).promise;
			pdfDocRef.current = pdf;
			setNumPages( pdf.numPages );
			await renderPage( pdf, pageNum );
		} catch ( err ) {
			setError(
				err instanceof Error
					? err.message
					: __( 'Failed to load PDF', 'media-experiments' )
			);
			setIsLoading( false );
		}
	};

	const goToPage = async ( newPageNum: number ) => {
		if ( ! pdfDocRef.current || newPageNum < 1 || newPageNum > numPages ) {
			return;
		}

		setPageNum( newPageNum );
		await renderPage( pdfDocRef.current, newPageNum );
	};

	useEffect( () => {
		return () => {
			if ( pdfDocRef.current ) {
				void pdfDocRef.current.destroy();
			}
		};
	}, [] );

	const handleLoadClick = () => {
		void loadPDF();
	};

	const handlePrevClick = () => {
		void goToPage( pageNum - 1 );
	};

	const handleNextClick = () => {
		void goToPage( pageNum + 1 );
	};

	return (
		<div
			ref={ containerRef }
			className={ `mexp-pdf-viewer ${ className }` }
		>
			{ ! isLoaded && posterUrl && ! isLoading && (
				<div className="mexp-pdf-viewer__poster">
					<img src={ posterUrl } alt="" />
					<button
						type="button"
						className="mexp-pdf-viewer__load-button"
						onClick={ handleLoadClick }
					>
						{ __( 'Load PDF', 'media-experiments' ) }
					</button>
				</div>
			) }

			{ isLoading && (
				<div className="mexp-pdf-viewer__loading">
					<Spinner />
				</div>
			) }

			{ error && (
				<div className="mexp-pdf-viewer__error">
					{ __( 'Error:', 'media-experiments' ) } { error }
				</div>
			) }

			<canvas
				ref={ canvasRef }
				className="mexp-pdf-viewer__canvas"
				style={ {
					display: isLoaded ? 'block' : 'none',
				} }
			/>

			{ isLoaded && numPages > 1 && (
				<div className="mexp-pdf-viewer__controls">
					<button
						type="button"
						onClick={ handlePrevClick }
						disabled={ pageNum <= 1 }
						className="mexp-pdf-viewer__button"
					>
						{ __( 'Previous', 'media-experiments' ) }
					</button>
					<span className="mexp-pdf-viewer__page-info">
						{ pageNum } / { numPages }
					</span>
					<button
						type="button"
						onClick={ handleNextClick }
						disabled={ pageNum >= numPages }
						className="mexp-pdf-viewer__button"
					>
						{ __( 'Next', 'media-experiments' ) }
					</button>
				</div>
			) }
		</div>
	);
}
