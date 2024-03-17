import { addFilter } from '@wordpress/hooks';

type CrossOriginValue = 'anonymous' | 'use-credentials' | '' | undefined;

// @ts-ignore -- Params are unused, but maybe we need them in the future.
function forceCrossOrigin( imgCrossOrigin: CrossOriginValue, url: string ) {
	return 'anonymous' as CrossOriginValue;
}

function addAttribute( el: HTMLElement ) {
	if ( ! el.hasAttribute( 'crossorigin' ) ) {
		el.setAttribute( 'crossorigin', 'anonymous' );
	}

	if ( el.nodeName === 'IFRAME' && ! el.hasAttribute( 'credentialless' ) ) {
		el.setAttribute( 'credentialless', 'true' );

		if ( ! el.hasAttribute( 'src' ) ) {
			el.setAttribute( 'src', '');
		}
	}
}

if ( window.crossOriginIsolated ) {
	addFilter(
		'media.crossOrigin',
		'media-experiments/cross-origin-isolation/force-crossorigin',
		forceCrossOrigin
	);

	/**
	 * Complementary component to the Cross_Origin_Isolation PHP class
	 * that detects dynamically added DOM nodes that are missing the `crossorigin` attribute.
	 * These are typically found in custom meta boxes and the WordPress admin bar.
	 *
	 * @return {null} Rendered component
	 */

	const observer = new MutationObserver( ( mutations ) => {
		mutations.forEach( ( mutation ) => {
			// console.log( mutation );
			[ mutation.addedNodes, mutation.target ].forEach( ( node ) => {
				const nodes = node instanceof NodeList ? node : [ node ];
				nodes.forEach( ( n ) => {
					( n as HTMLElement )
						.querySelectorAll(
							'img,source,script,video,link,iframe'
						)
						.forEach( ( el ) => {
							addAttribute( el as HTMLElement );
						} );

					if ( n.nodeName === 'IFRAME' ) {
						// @ts-ignore
						const iframeNode: HTMLIFrameElement = n;

						iframeNode.addEventListener( 'load', () => {
							if ( iframeNode.contentDocument !== null ) {
								observer.observe( iframeNode.contentDocument, {
									childList: true,
									attributes: true,
									subtree: true,
								} );
							}
						} );
					}

					if (
						[
							'IMG',
							'SOURCE',
							'SCRIPT',
							'VIDEO',
							'LINK',
							'IFRAME',
						].includes( n.nodeName )
					) {
						addAttribute( n as HTMLElement );
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
