import { type BlockInstance } from '@wordpress/blocks';

export type ImageBlock = BlockInstance< {
	id: number;
	url: string;
} > & { name: 'core/image' };

export type AudioBlock = BlockInstance< {
	id: number;
	url: string;
} > & { name: 'core/audio' };

export type VideoBlock = BlockInstance< {
	id: number;
	src: string;
	poster: string;
	muted: boolean;
	caption: string;
	tracks: Array< {
		src?: string;
		label?: string;
		srcLang?: string;
		kind: 'subtitles' | 'captions';
	} >;
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
