/**
 * WordPress dependencies
 */
import { useLayoutEffect } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { isGifVariation } from '../gif-block/utils';
import type { VideoBlock } from '../types';

interface GifLooperProps {
	attributes: VideoBlock[ 'attributes' ];
}

// This should eventually live in the video block's edit component.
export function GifLooper( { attributes }: GifLooperProps ) {
	const isGif = isGifVariation( attributes );
	const url = attributes.src;

	// Force video to loop and autoplay.
	useLayoutEffect( () => {
		if ( ! isGif || ! url ) {
			return;
		}

		const editorCanvas =
			(
				( document.querySelector(
					'iframe[name="editor-canvas"]'
				) as HTMLIFrameElement ) || null
			)?.contentDocument || document;

		const videoPlayer = editorCanvas.querySelector(
			`video[src="${ url }"]`
		) as HTMLVideoElement | null;

		if ( videoPlayer ) {
			videoPlayer.muted = true;
			videoPlayer.loop = true;
			videoPlayer.autoplay = true;
			try {
				void videoPlayer.play();
			} catch {
				// Do nothing if playing fails.
			}
		}
	}, [ url, isGif ] );

	return null;
}
