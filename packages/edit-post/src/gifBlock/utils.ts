export function isGifVariation( blockAttributes: Record< string, unknown > ) {
	const { controls, loop, autoplay, muted, playsInline } = blockAttributes;
	return ! controls && loop && autoplay && muted && playsInline;
}
