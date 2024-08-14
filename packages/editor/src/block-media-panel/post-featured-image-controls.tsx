/**
 * External dependencies
 */
import type { Attachment } from '@mexp/media-utils';

/**
 * WordPress dependencies
 */
import { Fragment } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { useFeaturedImageAttachment } from '../utils/hooks';
import { UploadIndicator } from './upload-indicator';
import { OptimizeMedia } from './optimize-media';
import { DebugInfo } from './debug-info';

export function PostFeaturedImageControls() {
	const { featuredImage, setFeaturedImage, attachment } =
		useFeaturedImageAttachment();

	if ( ! featuredImage || ! attachment ) {
		return null;
	}

	function onChange( media: Partial< Attachment > ) {
		if ( ! media || ! media.id ) {
			return;
		}

		setFeaturedImage( media.id );
	}

	return (
		<Fragment>
			<UploadIndicator id={ featuredImage } />
			<OptimizeMedia
				id={ featuredImage }
				url={ attachment.source_url }
				onSuccess={ onChange }
			/>
			<DebugInfo id={ featuredImage } />
		</Fragment>
	);
}
