/**
 * Internal dependencies
 */
import { useBlockAttachments } from '../utils/hooks';
import { UploadIndicator } from './upload-indicator';
import { DebugInfo } from './debug-info';
import { BulkOptimization } from '../components/bulk-optimization';
import type { PostFeaturedImageBlock } from '../types';

export function PostFeaturedImageControls( props: PostFeaturedImageBlock ) {
	const attachments = useBlockAttachments( props.clientId );

	if ( ! attachments ) {
		return null;
	}

	return (
		<>
			<UploadIndicator id={ attachments[ 0 ].id } />
			<BulkOptimization attachments={ attachments } />
			<DebugInfo id={ attachments[ 0 ].id } />
		</>
	);
}
