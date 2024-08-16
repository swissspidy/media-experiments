/**
 * Internal dependencies
 */
import { useBlockAttachments } from '../utils/hooks';
import { UploadIndicator } from './upload-indicator';
import { DebugInfo } from './debug-info';
import type { SiteLogoBlock } from '../types';
import { BulkOptimization } from '../components/bulk-optimization';

type SiteLogoControlsProps = SiteLogoBlock;

export function SiteLogoControls( { clientId }: SiteLogoControlsProps ) {
	const attachments = useBlockAttachments( clientId );

	if ( ! attachments.length ) {
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
