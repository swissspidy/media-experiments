/**
 * WordPress dependencies
 */
import type {
	Attachment as CoreAttachment,
	RestAttachment as CoreRestAttachment,
} from '@wordpress/media-utils';

/**
 * Attachment fields added by this plugin on top of the ones WordPress exposes.
 *
 * The generic attachment shapes live in `@wordpress/media-utils`; only the
 * `mexp_*` additions are defined here.
 *
 * @see https://developer.wordpress.org/rest-api/reference/media/
 */
type MexpAttachmentFields = {
	mexp_filename: string | null;
	mexp_filesize: number | null;
	mexp_media_source: number[];
	meta: {
		mexp_generated_poster_id?: number;
		mexp_original_id?: number;
	};
	mexp_blurhash?: string;
	mexp_dominant_color?: string;
	mexp_is_muted?: boolean;
	mexp_has_transparency?: boolean;
	mexp_original_url: string | null;
};

/**
 * REST API attachment object with the additional fields added by this plugin.
 */
export type RestAttachment = CoreRestAttachment & MexpAttachmentFields;

/**
 * Transformed attachment object with the additional fields added by this plugin.
 */
export type Attachment = CoreAttachment & MexpAttachmentFields;

export type OnChangeHandler = ( attachments: Partial< Attachment >[] ) => void;
export type OnErrorHandler = ( error: Error ) => void;

export type CreateRestAttachment = Partial< RestAttachment > & {
	generate_sub_sizes?: boolean;
	convert_format?: boolean;
};

export type AdditionalData = Omit<
	CreateRestAttachment,
	'meta' | 'mexp_media_source'
>;

export interface CreateSideloadFile {
	image_size?: string;
}

export interface SideloadAdditionalData {
	post: RestAttachment[ 'id' ];
	image_size?: string;
}
