/**
 * WordPress dependencies
 */
import { addFilter } from '@wordpress/hooks';
import { createHigherOrderComponent } from '@wordpress/compose';
import { createPortal, useEffect, useRef, useState } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { PDFViewer } from './pdf-viewer';
import type { MediaPanelProps } from '../types';

interface FileBlockAttributes {
	id?: number;
	href?: string;
	fileName?: string;
	textLinkHref?: string;
	textLinkTarget?: string;
	showDownloadButton?: boolean;
	downloadButtonText?: string;
	displayPreview?: boolean;
	previewHeight?: number;
}

/**
 * Higher-order component that adds PDF.js viewer support for file blocks.
 *
 * Replaces the default <object> embed with a PDF.js-powered viewer
 * to work around cross-origin isolation issues.
 */
const withPDFViewer = createHigherOrderComponent(
	( BlockEdit ) => ( props: MediaPanelProps ) => {
		const { name, attributes } = props;
		const [ embedElement, setEmbedElement ] =
			useState< HTMLObjectElement | null >( null );
		const observerRef = useRef< MutationObserver | null >( null );

		if ( 'core/file' !== name ) {
			return <BlockEdit { ...props } />;
		}

		const fileAttributes = attributes as FileBlockAttributes;

		// Only proceed if we have a PDF and displayPreview is true
		const isPDF =
			fileAttributes.href &&
			fileAttributes.href.toLowerCase().endsWith( '.pdf' );
		const shouldReplace =
			isPDF &&
			fileAttributes.displayPreview &&
			window.crossOriginIsolated;

		useEffect( () => {
			if ( ! shouldReplace ) {
				return;
			}

			// Find the object element in the DOM
			const findObjectElement = () => {
				const blockElement = document.querySelector(
					`[data-block="${ props.clientId }"]`
				);
				if ( blockElement ) {
					const objectEl = blockElement.querySelector(
						'object[type="application/pdf"]'
					);
					if ( objectEl instanceof HTMLObjectElement ) {
						setEmbedElement( objectEl );
						return true;
					}
				}
				return false;
			};

			// Try to find the element immediately
			if ( ! findObjectElement() ) {
				// If not found, observe DOM changes
				observerRef.current = new MutationObserver( () => {
					if ( findObjectElement() && observerRef.current ) {
						observerRef.current.disconnect();
					}
				} );

				observerRef.current.observe( document.body, {
					childList: true,
					subtree: true,
				} );
			}

			return () => {
				if ( observerRef.current ) {
					observerRef.current.disconnect();
				}
			};
		}, [ shouldReplace, props.clientId ] );

		// Get poster URL from media details if available
		const getPosterUrl = (): string | undefined => {
			if ( ! fileAttributes.id ) {
				return undefined;
			}

			// Try to get the poster from WordPress media details
			// This will be available if a thumbnail was generated
			const media = window.wp?.media?.attachment?.( fileAttributes.id );
			if ( media ) {
				const sizes = media.get( 'sizes' );
				if ( sizes?.full?.url ) {
					return sizes.full.url;
				}
				if ( sizes?.medium?.url ) {
					return sizes.medium.url;
				}
				if ( sizes?.thumbnail?.url ) {
					return sizes.thumbnail.url;
				}
			}

			return undefined;
		};

		return (
			<>
				<BlockEdit { ...props } />
				{ shouldReplace &&
					embedElement &&
					fileAttributes.href &&
					createPortal(
						<PDFViewer
							url={ fileAttributes.href }
							posterUrl={ getPosterUrl() }
							className="wp-block-file__embed"
						/>,
						embedElement.parentElement || document.body
					) }
			</>
		);
	},
	'withPDFViewer'
);

addFilter(
	'editor.BlockEdit',
	'media-experiments/file-block-pdf-viewer',
	withPDFViewer
);
