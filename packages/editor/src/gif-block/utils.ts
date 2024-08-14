/**
 * Internal dependencies
 */
import type { VideoBlock } from '../block-media-panel/types';

export function isGifVariation(
	blockAttributes: VideoBlock[ 'attributes' ]
): boolean {
	const { controls, loop, autoplay, muted, playsInline } = blockAttributes;
	return ! controls && loop && autoplay && muted && playsInline;
}
