import { addFilter } from '@wordpress/hooks';
import { createHigherOrderComponent } from '@wordpress/compose';

type CrossOriginValue = 'anonymous' | 'use-credentials' | '' | undefined;

function forceCrossOrigin( _imgCrossOrigin: CrossOriginValue, _url: string ) {
	return 'anonymous' as CrossOriginValue;
}

function addAttribute( el: Element ) {
	if ( ! el.hasAttribute( 'crossorigin' ) ) {
		el.setAttribute( 'crossorigin', 'anonymous' );
	}

	if ( el.nodeName === 'IFRAME' && ! el.hasAttribute( 'credentialless' ) ) {
		el.setAttribute( 'credentialless', 'true' );

		if ( ! el.hasAttribute( 'src' ) ) {
			el.setAttribute( 'src', '' );
		} else {
			const origSrc = el.getAttribute( 'src' );
			if ( origSrc ) {
				el.setAttribute( 'src', '' );
				el.setAttribute( 'src', origSrc );
			}
		}
	}
}

if ( window.crossOriginIsolated ) {
	addFilter(
		'media.crossOrigin',
		'media-experiments/cross-origin-isolation/force-crossorigin',
		forceCrossOrigin
	);

	/*
	 * Complementary component to the Cross_Origin_Isolation PHP class
	 * that detects dynamically added DOM nodes that are missing the `crossorigin` attribute.
	 * These are typically found in custom meta boxes and the WordPress admin bar.
	 */
	const observer = new MutationObserver( ( mutations ) => {
		mutations.forEach( ( mutation ) => {
			[ mutation.addedNodes, mutation.target ].forEach( ( value ) => {
				const nodes = value instanceof NodeList ? value : [ value ];
				nodes.forEach( ( node ) => {
					const el: HTMLElement = node as HTMLElement;

					if ( ! el.querySelectorAll ) {
						// Most likely a text node.
						return;
					}

					el.querySelectorAll(
						'img,source,script,video,link,iframe'
					).forEach( ( v ) => {
						addAttribute( v );
					} );

					if ( el.nodeName === 'IFRAME' ) {
						const iframeNode: HTMLIFrameElement =
							el as HTMLIFrameElement;

						/*
						 * If for example embedding a tweet, it should be loaded
						 * in a credentialless iframe, but the tweet itself
						 * should not be modified.
						 */

						const isEmbedSandboxIframe =
							iframeNode.classList.contains(
								'components-sandbox'
							);

						if ( ! isEmbedSandboxIframe ) {
							iframeNode.addEventListener( 'load', () => {
								if ( iframeNode.contentDocument ) {
									observer.observe(
										iframeNode.contentDocument,
										{
											childList: true,
											attributes: true,
											subtree: true,
										}
									);
								}
							} );
						}
					}

					if (
						[
							'IMG',
							'SOURCE',
							'SCRIPT',
							'VIDEO',
							'LINK',
							'IFRAME',
						].includes( el.nodeName )
					) {
						addAttribute( el );
					}
				} );
			} );
		} );
	} );

	observer.observe( document.body, {
		childList: true,
		attributes: true,
		subtree: true,
	} );
}

const disableEmbedPreviews = createHigherOrderComponent(
	( BlockEdit ) => ( props ) => {
		if ( 'core/embed' !== props.name ) {
			return <BlockEdit { ...props } />;
		}

		return (
			<BlockEdit
				{ ...props }
				attributes={ { ...props.attributes, previewable: false } }
			/>
		);
	},
	'withDisabledEmbedPreview'
);

if (
	window.crossOriginIsolated &&
	! ( 'credentialless' in HTMLIFrameElement.prototype )
) {
	addFilter(
		'editor.BlockEdit',
		'media-experiments/disable-embed-previews',
		disableEmbedPreviews
	);
}
