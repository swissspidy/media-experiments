import { addFilter } from '@wordpress/hooks';
import { store as editPostStore } from '@wordpress/edit-post';
import { select as globalSelect, subscribe } from '@wordpress/data';

type CrossOriginValue = 'anonymous' | 'use-credentials' | '' | undefined;

// @ts-ignore -- Params are unused, but maybe we need them in the future.
function forceCrossOrigin( imgCrossOrigin: CrossOriginValue, url: string ) {
	return 'anonymous' as CrossOriginValue;
}

async function waitForChildren( element: Element ) {
	return new Promise< void >( ( resolve ) => {
		if ( ! element ) {
			return resolve();
		}

		if ( element.children.length ) {
			return resolve();
		}

		const obs = new MutationObserver( () => {
			if ( element.children.length ) {
				obs.disconnect();
				resolve();
			}
		} );

		obs.observe( element, {
			childList: true,
			subtree: true,
		} );
	} );
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

				const elements = [
					...( node as HTMLElement ).querySelectorAll( 'img' ),
				];
				if ( node instanceof HTMLImageElement ) {
					elements.push( node );
				}

				elements.forEach( ( el: HTMLImageElement ) => {
					if ( el.hasAttribute( 'crossorigin' ) ) {
						return;
					}

					const imgSrc = new URL( el.src );

					if ( imgSrc.origin !== location.origin ) {
						el.setAttribute( 'crossorigin', 'anonymous' );
					}
				} );
			} );
		} );
	} );

	let prevHasMetaBoxes = false;

	document.querySelectorAll( '#wpadminbar' ).forEach( ( subTree ) => {
		observer.observe( subTree, {
			childList: true,
			attributes: true,
			subtree: true,
		} );
	} );

	const unsubscribe = subscribe( async () => {
		const wrapperEl = document.querySelector(
			'.edit-post-layout__metaboxes'
		);
		const hasMetaBoxes =
			globalSelect( editPostStore ).areMetaBoxesInitialized() &&
			globalSelect( editPostStore ).hasMetaBoxes() &&
			globalSelect( editPostStore )
				.getActiveMetaBoxLocations()
				.some( ( location ) =>
					globalSelect( editPostStore ).isMetaBoxLocationVisible(
						location
					)
				) &&
			wrapperEl !== null;

		if ( hasMetaBoxes && ! prevHasMetaBoxes ) {
			prevHasMetaBoxes = hasMetaBoxes;
			unsubscribe();

			await waitForChildren( wrapperEl );

			observer.observe( wrapperEl, {
				attributes: true,
				subtree: true,
			} );
		}
	}, editPostStore );
}
