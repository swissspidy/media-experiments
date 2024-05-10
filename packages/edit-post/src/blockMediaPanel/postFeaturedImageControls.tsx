import { useSelect } from '@wordpress/data';
import { store as editorStore } from '@wordpress/editor';
import { useEntityProp } from '@wordpress/core-data';
import { Fragment } from '@wordpress/element';

import type { Attachment } from '@mexp/upload-media';

import { useAttachment } from '../utils/hooks';
import { UploadIndicator } from './uploadIndicator';
import { OptimizeMedia } from './optimizeMedia';
import { DebugInfo } from './debugInfo';

export function PostFeaturedImageControls() {
	const { type: postType, id: postId } = useSelect(
		( select ) => select( editorStore ).getCurrentPost(),
		[]
	);

	const [ featuredImage, setFeaturedImage ] = useEntityProp(
		'postType',
		postType,
		'featured_media',
		postId
	);

	const attachment = useAttachment( featuredImage );

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
