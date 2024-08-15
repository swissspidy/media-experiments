/**
 * External dependencies
 */
import type { Attachment } from '@mexp/media-utils';

/**
 * WordPress dependencies
 */
import type { BlockEditProps } from '@wordpress/blocks';
import { useDispatch } from '@wordpress/data';
import { store as blockEditorStore } from '@wordpress/block-editor';
import { createBlock } from '@wordpress/blocks';

/**
 * Internal dependencies
 */
import { BulkOptimization } from '../components/bulk-optimization';
import type { GalleryBlock } from '../types';
import { UploadRequestControls } from './upload-requests/controls';
import { useBlockAttachments } from '../utils/hooks';

type GalleryControlsProps = GalleryBlock &
	Pick< BlockEditProps< GalleryBlock[ 'attributes' ] >, 'setAttributes' >;

export function GalleryControls( props: GalleryControlsProps ) {
	const attachments = useBlockAttachments( props.clientId );

	const { replaceInnerBlocks } = useDispatch( blockEditorStore );

	function onInsertFromUploadRequest( images: Partial< Attachment >[] ) {
		const newBlocks = images.map( ( image ) => {
			return createBlock( 'core/image', {
				id: image.id,
				url: image.url,
				caption: image.caption,
				alt: image.alt,
			} );
		} );

		void replaceInnerBlocks( props.clientId, newBlocks );
	}

	return (
		<>
			<BulkOptimization attachments={ attachments } />
			{ ! attachments.length ? (
				<UploadRequestControls
					onInsert={ onInsertFromUploadRequest }
					allowedTypes={ [ 'image' ] }
					accept={ [ 'image/*' ] }
					multiple
				/>
			) : null }
		</>
	);
}
