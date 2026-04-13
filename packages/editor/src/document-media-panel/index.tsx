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
import { CollaborationRequestControls } from '../block-media-panel/collaboration-requests/controls';
import { useBlockAttachments } from '../utils/hooks';

function DocumentMediaPanel() {
	const attachments = useBlockAttachments();

	return (
		<PluginDocumentSettingPanel
			name="media-experiments-document-panel"
			icon={ mediaIcon }
			title={ __( 'Media Experiments', 'media-experiments' ) }
		>
			<CollaborationRequestControls />
			{ attachments.length > 0 && (
				<BulkOptimization attachments={ attachments } />
			) }
		</PluginDocumentSettingPanel>
	);
}

registerPlugin( 'media-experiments-document-panel', {
	render: DocumentMediaPanel,
} );
