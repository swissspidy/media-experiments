/**
 * WordPress dependencies
 */
import type { BlockEditProps } from '@wordpress/blocks';

/**
 * Internal dependencies
 */
import { BulkOptimization } from '../components/bulk-optimization';
import type { GalleryBlock } from '../types';
import { useBlockAttachments } from '../utils/hooks';

type GalleryControlsProps = GalleryBlock &
	Pick< BlockEditProps< GalleryBlock[ 'attributes' ] >, 'setAttributes' >;

export function GalleryControls( props: GalleryControlsProps ) {
	const attachments = useBlockAttachments( props.clientId );

	return <BulkOptimization attachments={ attachments } />;
}
