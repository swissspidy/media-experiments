/**
 * External dependencies
 */
import { store as uploadStore } from '@mexp/upload-media';
import type { RestAttachment } from '@mexp/media-utils';

/**
 * WordPress dependencies
 */
import type { BlockInstance } from '@wordpress/blocks';
import { useSelect } from '@wordpress/data';
import { store as blockEditorStore } from '@wordpress/block-editor';
import { store as coreStore } from '@wordpress/core-data';

/**
 * Internal dependencies
 */
import type { BulkOptimizationAttachmentData } from '../types';

const SUPPORTED_BLOCKS = [ 'core/image', 'core/video' ];

type ImageBlock = BlockInstance< {
	id: number;
	url: string;
} > & { name: 'core/image' };

type VideoBlock = BlockInstance< {
	id: number;
	src: string;
	poster: string;
	muted: boolean;
} > & { name: 'core/video' };

function isSupportedBlock(
	block: BlockInstance | null
): block is VideoBlock | ImageBlock {
	return block !== null && SUPPORTED_BLOCKS.includes( block.name );
}

export function useMediaBlockAttachments() {
	// TODO: Allow optimizing video posters themselves.
	// Need to get the poster ID from REST API via something like attachment_url_to_postid().
	// TODO: Refactor to be less ugly and more performant.
	return useSelect(
		( select ) =>
			select( blockEditorStore )
				.getClientIdsWithDescendants()
				.map( ( clientId ) =>
					select( blockEditorStore ).getBlock( clientId )
				)
				.filter( isSupportedBlock )
				// TODO: Also include external images that would simply be imported & then optimized.
				.filter( ( block ) => block.attributes.id )
				.reduce(
					( acc, block ) => {
						if (
							! acc.find(
								( b ) => b.attributes.id === block.attributes.id
							)
						) {
							acc.push( block );
						}
						return acc;
					},
					[] as Array< VideoBlock | ImageBlock >
				)
				.map( ( block: ImageBlock | VideoBlock ) => {
					const attachment: BulkOptimizationAttachmentData = {
						clientId: block.clientId,
						id: block.attributes.id,
						url:
							'url' in block.attributes
								? block.attributes.url
								: block.attributes.src,
						posterUrl:
							'src' in block.attributes
								? block.attributes.poster
								: block.attributes.url,
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
		[]
	);
}
