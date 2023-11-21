import { type BlockAttributes } from '@wordpress/blocks';

export function isGifVariation( blockAttributes: BlockAttributes ): boolean {
	const { controls, loop, autoplay, muted, playsInline } = blockAttributes;
	return ! controls && loop && autoplay && muted && playsInline;
}
