import { type BlockEditProps, type BlockInstance } from '@wordpress/blocks';
import { useSelect } from '@wordpress/data';
import { store as blockEditorStore } from '@wordpress/block-editor';
import { store as coreStore } from '@wordpress/core-data';

import { type RestAttachment, store as uploadStore } from '@mexp/upload-media';

import { BulkOptimization } from '../components/bulkOptimization';
import type { BulkOptimizationAttachmentData } from '../types';
import type { GalleryBlock, ImageBlock } from './types';

type GalleryControlsProps = GalleryBlock &
	Pick< BlockEditProps< GalleryBlock[ 'attributes' ] >, 'setAttributes' >;

// TODO: Refactor to be less ugly and more performant.
function useGalleryImageAttachments( clientId: BlockInstance[ 'clientId' ] ) {
	const innerBlockImages = useSelect(
		( select ) => {
			return (
				( select( blockEditorStore ).getBlock( clientId )
					?.innerBlocks as ImageBlock[] ) ?? []
			);
		},
		[ clientId ]
	);

	return useSelect(
		( select ) =>
			innerBlockImages
				.filter( ( block ) => block.attributes.id )
				// TODO: Also include external images that would simply be imported & then optimized.
				.reduce( ( acc, block ) => {
					if (
						! acc.find(
							( b ) => b.attributes.id === block.attributes.id
						)
					) {
						acc.push( block );
					}
					return acc;
				}, [] as Array< ImageBlock > )
				.map( ( block ) => {
					const attachment: BulkOptimizationAttachmentData = {
						clientId: block.clientId,
						id: block.attributes.id,
						url: block.attributes.url,
						posterUrl: block.attributes.url,
						fileSize: 0,
						isUploading: select( uploadStore ).isUploadingById(
							block.attributes.id
						),
						isOptimized: false,
						isFetched: false,
					};

					// @ts-ignore -- TODO: Fix this without casting.
					const media: RestAttachment | undefined = select(
						coreStore
					).getMedia( block.attributes.id, {
						context: 'edit',
					} );

					if ( media ) {
						attachment.isFetched = true;

						attachment.isOptimized =
							media.mexp_media_source.length > 0;

						// TODO: Use fetchRemoteFile() as fallback.
						if ( media.mexp_filesize ) {
							attachment.fileSize = media.mexp_filesize;
						}
					}

					return attachment;
				} )
				.filter( ( data ) => data.isFetched && ! data.isOptimized ),
		[ innerBlockImages ]
	);
}

export function GalleryControls( props: GalleryControlsProps ) {
	const attachments = useGalleryImageAttachments( props.clientId );

	return <BulkOptimization attachments={ attachments } />;
}
