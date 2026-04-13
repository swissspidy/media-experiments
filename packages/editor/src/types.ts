/**
 * External dependencies
 */
import type { Attachment } from '@mexp/media-utils';
import type {
	AudioFormat,
	ImageFormat,
	ImageLibrary,
	ThumbnailGeneration,
	VideoFormat,
	ImageSizeCrop,
} from '@mexp/upload-media';

/**
 * WordPress dependencies
 */
import type { BlockInstance, BlockEditProps } from '@wordpress/blocks';

export type ImageBlock = BlockInstance< {
	id: number;
	url: string;
	// New local attribute in WordPress 6.7.
	blob: string;
	caption: string;
	alt: string;
} > & { name: 'core/image' };

export type AudioBlock = BlockInstance< {
	id: number;
	src: string;
	// New local attribute in WordPress 6.7.
	blob: string;
} > & { name: 'core/audio' };

export type VideoBlock = BlockInstance< {
	id: number;
	src: string;
	// New local attribute in WordPress 6.7.
	blob: string;
	poster: string;
	muted: boolean;
	caption: string;
	tracks: Array< {
		src?: string;
		label?: string;
		srcLang?: string;
		kind: 'subtitles' | 'captions';
	} >;
	controls: boolean;
	loop: boolean;
	autoplay: boolean;
	playsInline: boolean;
} > & { name: 'core/video' };

export type MediaTextBlock = BlockInstance< {
	mediaId: number;
	mediaUrl: string;
	mediaType: string;
} > & { name: 'core/media-text' };

export type GalleryBlock = BlockInstance< {
	images: Array< {
		id: number;
		url: string;
		alt: string;
		caption: string;
	} >;
} > & { name: 'core/gallery' };

export type CoverBlock = BlockInstance< {
	id: number;
	url: string;
	useFeaturedImage: boolean;
	backgroundType: string;
} > & { name: 'core/cover' };

export type PostFeaturedImageBlock = BlockInstance< {} > & {
	name: 'core/post-featured-image';
};

export type SiteLogoBlock = BlockInstance< {
	shouldSyncIcon: boolean;
} > & {
	name: 'core/site-logo';
};

export type EmbedBlock = BlockInstance< {
	url: string;
	providerNameSlug: string;
} > & {
	name: 'core/embed';
};

export type MediaPanelProps =
	| ( ImageBlock &
			Pick<
				BlockEditProps< ImageBlock[ 'attributes' ] >,
				'setAttributes' | 'className'
			> )
	| ( VideoBlock &
			Pick<
				BlockEditProps< VideoBlock[ 'attributes' ] >,
				'setAttributes' | 'className'
			> )
	| ( AudioBlock &
			Pick<
				BlockEditProps< AudioBlock[ 'attributes' ] >,
				'setAttributes' | 'className'
			> )
	| ( GalleryBlock &
			Pick<
				BlockEditProps< GalleryBlock[ 'attributes' ] >,
				'setAttributes' | 'className'
			> )
	| ( MediaTextBlock &
			Pick<
				BlockEditProps< MediaTextBlock[ 'attributes' ] >,
				'setAttributes' | 'className'
			> )
	| ( CoverBlock &
			Pick<
				BlockEditProps< CoverBlock[ 'attributes' ] >,
				'setAttributes' | 'className'
			> )
	| ( PostFeaturedImageBlock &
			Pick<
				BlockEditProps< PostFeaturedImageBlock[ 'attributes' ] >,
				'setAttributes' | 'className'
			> )
	| ( SiteLogoBlock &
			Pick<
				BlockEditProps< SiteLogoBlock[ 'attributes' ] >,
				'setAttributes' | 'className'
			> )
	| ( EmbedBlock &
			Pick<
				BlockEditProps< EmbedBlock[ 'attributes' ] >,
				'setAttributes' | 'className'
			> );

// Keep in sync with PHP.
export type MediaSourceTerm =
	| 'media-optimization'
	| 'poster-generation'
	| 'media-import'
	| 'gif-conversion'
	| 'subtitles-generation';

export type RestBaseRecord = {
	description: string;
	gmt_offset: number;
	home: string;
	name: string;
	site_icon: number;
	site_icon_url: string | false;
	site_logo: number;
	timezone_string: string;
	url: string;
	// The following ones are added by Media Experiments.
	image_size_threshold: number;
	video_size_threshold: number;
	image_output_formats: Record< string, string >;
	jpeg_interlaced: boolean;
	png_interlaced: boolean;
	gif_interlaced: boolean;
	image_sizes: Record< string, ImageSizeCrop >;
	video_sizes?: Record<
		string,
		{ name: string; width: number; height: number }
	>;
	media_source_terms: Record< MediaSourceTerm, number >;
};

export type BulkOptimizationAttachmentData = {
	id: number;
	url: string;
	filesize: number | null;
	filename: string | null;
	onChange: ( media: Partial< Attachment > ) => void;
	additionalData?: Record< string, unknown >;
};

export type MediaPreferences = {
	// General.
	welcomeGuide: boolean;
	requireApproval: boolean;
	optimizeOnUpload: boolean;
	thumbnailGeneration: ThumbnailGeneration;
	imageLibrary: ImageLibrary;
	bigImageSizeThreshold: number;
	bigVideoSizeThreshold: number;
	keepOriginal: boolean;
	convertUnsafe: boolean;
	useAi: boolean;
	// Formats.
	default_outputFormat: ImageFormat;
	default_quality: number;
	default_interlaced: boolean;
	jpeg_outputFormat: ImageFormat;
	jpeg_quality: number;
	jpeg_interlaced: boolean;
	png_outputFormat: ImageFormat;
	png_quality: number;
	png_interlaced: boolean;
	webp_outputFormat: ImageFormat;
	webp_quality: number;
	webp_interlaced: boolean;
	avif_outputFormat: ImageFormat;
	avif_quality: number;
	avif_interlaced: boolean;
	gif_outputFormat: ImageFormat;
	gif_quality: number;
	gif_interlaced: boolean;
	gif_convert: boolean;
	video_outputFormat: VideoFormat;
	audio_outputFormat: AudioFormat;
	// Media recording.
	videoInput?: string;
	audioInput?: string;
	videoEffect: 'none' | 'blur';
};
