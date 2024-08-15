/**
 * External dependencies
 */
import type { Attachment, RestAttachment } from '@mexp/media-utils';
import { store as uploadStore } from '@mexp/upload-media';

/**
 * WordPress dependencies
 */
import {
	store as coreStore,
	useEntityProp,
	useEntityRecord,
} from '@wordpress/core-data';
import { useDispatch, useSelect } from '@wordpress/data';
import { isBlobURL } from '@wordpress/blob';
import { store as editorStore } from '@wordpress/editor';
import { store as blockEditorStore } from '@wordpress/block-editor';

/**
 * Internal dependencies
 */
import type { BulkOptimizationAttachmentData } from '../types';

export function useAttachment( id?: number ) {
	const { record } = useEntityRecord( 'postType', 'attachment', id || 0 );
	return record as RestAttachment | null;
}

export function useIsUploadingById( id?: number ) {
	return useSelect(
		( select ) =>
			id ? select( uploadStore ).isUploadingById( id ) : false,
		[ id ]
	);
}

export function useIsUploadingByUrl( url?: string ) {
	return useSelect(
		( select ) => {
			if ( ! url ) {
				return false;
			}

			const isUploading = select( uploadStore ).isUploadingByUrl( url );

			return isUploading || isBlobURL( url );
		},
		[ url ]
	);
}

export function useFeaturedImage() {
	const { type: postType, id: postId } = useSelect(
		( select ) => select( editorStore ).getCurrentPost(),
		[]
	);

	const [ featuredImage, setFeaturedImage ] = useEntityProp(
		'postType',
		postType,
		'featured_media',
		postId as number
	) as [ number | undefined, ( id: number ) => void, unknown ];

	const attachment = useAttachment( featuredImage );

	return {
		featuredImage,
		setFeaturedImage,
		attachment,
	};
}

/**
 * Returns all media attachments in a given document, from the featured image to
 * the ones found in blocks.
 */
export function useDocumentAttachments() {
	const { updateBlockAttributes } = useDispatch( blockEditorStore );

	return useSelect(
		( select ) =>
			select( blockEditorStore )
				.getClientIdsWithDescendants()
				.map( ( clientId ) =>
					select( blockEditorStore ).getBlock( clientId )
				)
				.filter( ( block ) => block !== null )
				.map( ( block ) => {
					const attachment: Partial< BulkOptimizationAttachmentData > =
						{
							filesize: 0,
							filename: '',
							isFetched: false,
						};

					if ( block.name === 'core/image' && block.attributes.id ) {
						attachment.id = block.attributes.id;
						attachment.url = block?.attributes.url;
						attachment.onChange = (
							media: Partial< Attachment >
						) => {
							void updateBlockAttributes( block.clientId, {
								id: media.id,
								url: media.url,
							} );
						};

						return attachment as BulkOptimizationAttachmentData;
					}

					if (
						block.name === 'core/media-text' &&
						block.attributes.mediaId &&
						block.attributes.mediaType === 'image'
					) {
						attachment.id = block.attributes.mediaId;
						attachment.url = block?.attributes.mediaUrl;
						attachment.onChange = (
							media: Partial< Attachment >
						) => {
							void updateBlockAttributes( block.clientId, {
								mediaId: media.id,
								mediaUrl: media.url,
							} );
						};

						return attachment as BulkOptimizationAttachmentData;
					}

					if (
						block.name === 'core/cover' &&
						block.attributes.id &&
						block.attributes.backgroundType === 'image'
					) {
						attachment.id = block.attributes.id;
						attachment.url = block?.attributes.url;
						attachment.onChange = (
							media: Partial< Attachment >
						) => {
							void updateBlockAttributes( block.clientId, {
								id: media.id,
								url: media.url,
							} );
						};

						return attachment as BulkOptimizationAttachmentData;
					}

					return null;
				} )
				.filter(
					( attachment, index, arr ) =>
						attachment !== null &&
						arr.findIndex( ( a ) => a?.id === attachment.id ) ===
							index
				)
				.filter( ( attachment ) => attachment !== null )
				.map( ( attachment ) => {
					// @ts-ignore
					const media: RestAttachment | undefined = select(
						coreStore
					).getMedia( attachment.id, {
						context: 'edit',
					} );

					if ( media ) {
						attachment.isFetched = true;

						// TODO: Use fetchFile() as fallback.
						if ( media.mexp_filesize ) {
							attachment.filesize = media.mexp_filesize;
						}

						if ( media.mexp_filename ) {
							attachment.filename = media.mexp_filename;
						}
					}

					return attachment;
				} )
				.filter( ( data ) => data.isFetched ),
		[ updateBlockAttributes ]
	);
}
