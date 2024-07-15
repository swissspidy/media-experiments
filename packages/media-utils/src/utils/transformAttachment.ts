import type { Attachment, RestAttachment } from './types';

/**
 * Transforms an attachment object from the REST API shape into the shape expected by the block editor.
 *
 * @param attachment Attachment object.
 */
export function transformAttachment( attachment: RestAttachment ): Attachment {
	return {
		id: attachment.id,
		alt: attachment.alt_text,
		caption: attachment.caption?.raw ?? '',
		title: attachment.title.raw,
		url: attachment.source_url,
		mimeType: attachment.mime_type,
		blurHash: attachment.mexp_blurhash,
		dominantColor: attachment.mexp_dominant_color,
		posterId: attachment.featured_media,
		missingImageSizes: attachment.missing_image_sizes,
		fileName: attachment.mexp_filename,
		media_details: attachment.media_details,
	} as Attachment;
}
