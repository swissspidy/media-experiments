/**
 * External dependencies
 */
import type { Attachment } from '@mexp/media-utils';

/**
 * WordPress dependencies
 */
import { registerPlugin } from '@wordpress/plugins';
import { PluginDocumentSettingPanel } from '@wordpress/editor';
import { __ } from '@wordpress/i18n';
import { media as mediaIcon } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import { BulkOptimization } from '../components/bulk-optimization';

import { useMediaBlockAttachments } from './use-media-block-attachments';

import { useFeaturedImageAttachment } from '../utils/hooks';
import { OptimizeMedia } from '../block-media-panel/optimize-media';
import { UploadIndicator } from '../block-media-panel/upload-indicator';

function DocumentMediaPanel() {
	const attachments = useMediaBlockAttachments();
	const {
		featuredImage,
		setFeaturedImage,
		attachment: featuredImageAttachment,
	} = useFeaturedImageAttachment();

	function onChange( media: Partial< Attachment > ) {
		if ( ! media || ! media.id ) {
			return;
		}

		setFeaturedImage( media.id );
	}

	if ( ! attachments.length && ! featuredImageAttachment ) {
		return null;
	}

	return (
		<PluginDocumentSettingPanel
			name="media-experiments-document-panel"
			icon={ mediaIcon }
			title={ __( 'Media Experiments', 'media-experiments' ) }
		>
			<BulkOptimization attachments={ attachments } />
			{ featuredImageAttachment && featuredImage ? (
				<>
					<UploadIndicator id={ featuredImage } />
					<OptimizeMedia
						id={ featuredImage }
						url={ featuredImageAttachment.source_url }
						onSuccess={ onChange }
						label={ __(
							'Optimize featured image',
							'media-experiments'
						) }
					/>
				</>
			) : null }
		</PluginDocumentSettingPanel>
	);
}

registerPlugin( 'media-experiments-document-panel', {
	render: DocumentMediaPanel,
} );
