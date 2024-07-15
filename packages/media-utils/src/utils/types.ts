import type { WP_REST_API_Attachment } from 'wp-types';

export type Attachment = {
	id: number;
	url: string;
	alt: string;
	caption?: string;
	title: string;
	mimeType: string;
	poster?: string;
	blurHash?: string;
	dominantColor?: string;
	posterId?: number;
	// Video block expects such a structure for the poster.
	// https://github.com/WordPress/gutenberg/blob/e0a413d213a2a829ece52c6728515b10b0154d8d/packages/block-library/src/video/edit.js#L154
	image?: {
		src: string;
	};
	missingImageSizes?: string[];
	fileName?: string;
	fileSize?: number;
};

export type OnChangeHandler = ( attachments: Partial< Attachment >[] ) => void;
export type OnSuccessHandler = ( attachments: Partial< Attachment >[] ) => void;
export type OnErrorHandler = ( error: Error ) => void;

export interface RestAttachment extends WP_REST_API_Attachment {
	mexp_filename: string | null;
	mexp_filesize: number | null;
	mexp_media_source: number[];
	meta: {
		mexp_generated_poster_id?: number;
		mexp_original_id?: number;
		mexp_optimized_id?: number;
	};
	mexp_blurhash?: string;
	mexp_dominant_color?: string;
	mexp_is_muted?: boolean;
	mexp_has_transparency?: boolean;
}

export type CreateRestAttachment = Partial< RestAttachment > & {
	generate_sub_sizes?: boolean;
};

export type AdditionalData = Omit<
	CreateRestAttachment,
	'meta' | 'mexp_media_source'
> & {
	/**
	 * The ID for the associated post of the attachment.
	 *
	 * TODO: Figure out why it's not inherited from RestAttachment / WP_REST_API_Attachment type.
	 */
	post?: RestAttachment[ 'id' ];
};

export type CreateSideloadFile = {
	image_size?: string;
	upload_request?: string;
};

export type SideloadAdditionalData = {
	post: RestAttachment[ 'id' ];
	image_size?: string;
	upload_request?: string;
};
