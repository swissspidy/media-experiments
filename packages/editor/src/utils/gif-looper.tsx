/**
 * WordPress dependencies
 */
import { useLayoutEffect } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { useIsGifVariation } from '../utils/hooks';

interface GifLooperProps {
	clientId: string;
}

/**
 * Forces a video block's video to autoplay when it is a GIF variation.
 *
 * This should eventually live in the video block's edit component.
 *
 * @todo Honor prefers-reduced-motion and only play GIF on hover.
 *
 * @param $0
 * @param $0.clientId Block client ID.
 */
export function GifLooper( { clientId }: GifLooperProps ) {
	const isGif = useIsGifVariation( clientId );

	// Force video to loop and autoplay.
	useLayoutEffect( () => {
		const editorCanvas =
			(
				( document.querySelector(
					'iframe[name="editor-canvas"]'
				) as HTMLIFrameElement ) || null
			)?.contentDocument || document;

		const videoPlayer = editorCanvas.querySelector(
			`[data-block="${ clientId }"] video`
		) as HTMLVideoElement | null;

		if ( videoPlayer ) {
			if ( ! isGif ) {
				videoPlayer.pause();
				videoPlayer.muted = false;
				videoPlayer.loop = false;
				videoPlayer.autoplay = false;
				videoPlayer.currentTime = 0;
			} else {
				videoPlayer.muted = true;
				videoPlayer.loop = true;
				videoPlayer.autoplay = true;
				videoPlayer.currentTime = 0;
				try {
					void videoPlayer.play();
				} catch {
					// Do nothing if playing fails.
				}
			}
		}
	}, [ isGif, clientId ] );

	return null;
}
