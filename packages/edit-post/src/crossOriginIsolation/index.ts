import { addFilter } from '@wordpress/hooks';

type CrossOriginValue = 'anonymous' | 'use-credentials' | '' | undefined;

// @ts-ignore -- Params are unused, but maybe we need them in the future.
function forceCrossOrigin( imgCrossOrigin: CrossOriginValue, url: string ) {
	return 'anonymous' as CrossOriginValue;
}

function addAttribute( el: HTMLElement ) {
	if ( el.hasAttribute( 'crossorigin' ) ) {
		return;
	}

	el.setAttribute( 'crossorigin', 'anonymous' );
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
			[ mutation.addedNodes, mutation.target ].forEach( ( node ) => {
				if (
					! ( 'querySelectorAll' in node ) ||
					! node.querySelectorAll
				) {
					return;
				}

				( node as HTMLElement )
					.querySelectorAll( 'img,source,script,video,link' )
					.forEach( ( el ) => {
						addAttribute( el as HTMLElement );
					} );

				if (
					node instanceof HTMLImageElement ||
					node instanceof HTMLSourceElement ||
					node instanceof HTMLScriptElement ||
					node instanceof HTMLVideoElement ||
					node instanceof HTMLLinkElement
				) {
					addAttribute( node );
				}
			} );
		} );
	} );

	observer.observe( document.body, {
		childList: true,
		attributes: true,
		subtree: true,
	} );
}
