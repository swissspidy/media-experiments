/**
 * External dependencies
 */
import type { Attachment, RestAttachment } from '@mexp/media-utils';
import { store as uploadStore } from '@mexp/upload-media';

/**
 * WordPress dependencies
 */
import { Fragment } from '@wordpress/element';
import type { BlockEditProps, BlockInstance } from '@wordpress/blocks';
import { useDispatch, useSelect } from '@wordpress/data';
import { store as blockEditorStore } from '@wordpress/block-editor';
import { store as coreStore } from '@wordpress/core-data';
import { createBlock } from '@wordpress/blocks';

/**
 * Internal dependencies
 */
import { BulkOptimization } from '../components/bulk-optimization';
import type { BulkOptimizationAttachmentData } from '../types';
import type { GalleryBlock, ImageBlock } from './types';
import { UploadRequestControls } from './upload-requests/controls';

type GalleryControlsProps = GalleryBlock &
	Pick< BlockEditProps< GalleryBlock[ 'attributes' ] >, 'setAttributes' >;

const EMPTY_ARRAY: never[] = [];

// TODO: Refactor to be less ugly and more performant.
function useGalleryImageAttachments( clientId: BlockInstance[ 'clientId' ] ) {
	const innerBlockImages = useSelect(
		( select ) => {
			return (
				( select( blockEditorStore ).getBlock( clientId )
					?.innerBlocks as ImageBlock[] ) ?? EMPTY_ARRAY
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
						mexp_filesize: 0,
						mexp_filename: '',
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

						// TODO: Use fetchFile() as fallback.
						if ( media.mexp_filesize ) {
							attachment.mexp_filesize = media.mexp_filesize;
						}

						if ( media.mexp_filename ) {
							attachment.mexp_filename = media.mexp_filename;
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
		<Fragment>
			<BulkOptimization attachments={ attachments } />
			{ ! attachments.length ? (
				<UploadRequestControls
					onInsert={ onInsertFromUploadRequest }
					allowedTypes={ [ 'image' ] }
					accept={ [ 'image/*' ] }
					multiple
				/>
			) : null }
		</Fragment>
	);
}
