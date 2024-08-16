/**
 * Internal dependencies
 */
import type { VideoBlock } from '../types';

export function isGifVariation(
	blockAttributes: VideoBlock[ 'attributes' ]
): boolean {
	const { controls, loop, autoplay, muted, playsInline } = blockAttributes;
	return ! controls && loop && autoplay && muted && playsInline;
}
