// Same type as in @mextp/upload-media
// TODO: Move to shared package?
export type ImageSizeCrop = {
	width: number;
	height: number;
	crop?:
		| boolean
		| [ 'left' | 'center' | 'right', 'top' | 'center' | 'bottom' ];
};

/**
 * none: Do nothing. Same as low.
 * centre: Just take the centre.
 * entropy: Use an entropy measure
 * attention: Look for features likely to draw human attention.
 * low: Position the crop towards the low coordinate. Same as none.
 * high: Position the crop towards the high coordinate.
 * all: Everything is interesting.
 */
type Interesting =
	| 'none'
	| 'centre'
	| 'entropy'
	| 'attention'
	| 'low'
	| 'high'
	| 'all';

/**
 * none: Don't attach metadata.
 * exif: Keep Exif metadata.
 * xmp: Keep XMP metadata.
 * iptc: Keep IPTC metadata.
 * icc: Keep ICC metadata.
 * other: Keep other metadata (e.g. PNG comments and some TIFF tags).
 * all: Keep all metadata.
 */
type ForeignKeep = 'none' | 'exif' | 'xmp' | 'iptc' | 'icc' | 'other' | 'all';

/**
 * The rendering intent.'absolute' is best for
 * scientific work, 'relative' is usually best for
 * accurate communication with other imaging libraries.
 *
 * perceptual: Perceptual rendering intent.
 * relative: Relative colorimetric rendering intent.
 * saturation: Saturation rendering intent.
 * absolute: Absolute colorimetric rendering intent.
 */
type Intent = 'perceptual' | 'relative' | 'saturation' | 'absolute';

/**
 * How sensitive loaders are to errors, from never stop (very insensitive), to
 * stop on the smallest warning (very sensitive).
 *
 * Each one implies the ones before it, so 'error' implies
 * 'truncated'.
 *
 * none: Never stop.
 * truncated: Stop on image truncated, nothing else.
 * error: Stop on serious error or truncation.
 * warning: Stop on anything, even warnings.
 */
type FailOn = 'none' | 'truncated' | 'error' | 'warning';

// TODO: Different options depending on mime type.
export type SaveOptions = {
	/**
	 * Quality factor.
	 */
	Q?: number;
	/**
	 * Which metadata to retain.
	 */
	keep?: ForeignKeep;
	/**
	 * Generate an interlaced (progressive) JPEG/PNG/GIF.
	 */
	interlace?: boolean;
	/**
	 * Enable lossless compression (for WebP).
	 */
	lossless?: boolean;
};

export type ThumbnailOptions = {
	/**
	 * Options that are passed on to the underlying loader.
	 */
	option_string?: string;
	/**
	 * Size to this height.
	 */
	height?: number;
	/**
	 * Only upsize, only downsize, or both.
	 */
	size?: 'both' | 'up' | 'down' | 'force';
	/**
	 * Don't use orientation tags to rotate image upright.
	 */
	no_rotate?: boolean;
	/**
	 * Reduce to fill target rectangle, then crop.
	 */
	crop?: Interesting;
	/**
	 * Reduce in linear light.
	 */
	linear?: boolean;
	/**
	 * Fallback import profile.
	 */
	import_profile?: string;
	/**
	 * Fallback export profile.
	 */
	export_profile?: string;
	/**
	 * Rendering intent.
	 */
	intent?: Intent;
	/**
	 * Error level to fail on.
	 */
	fail_on?: FailOn;
};
