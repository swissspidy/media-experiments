/**
 * External dependencies
 */
import type { Attachment, RestAttachment } from '@mexp/media-utils';
import { store as uploadStore } from '@mexp/upload-media';

/**
 * WordPress dependencies
 */
import {
	type Settings,
	store as coreStore,
	useEntityProp,
	useEntityRecord,
	useEntityRecords,
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

const EMPTY_ARRAY: never[] = [];

function useAttachmentsWithEntityRecords(
	attachments: Partial< BulkOptimizationAttachmentData >[],
	enabled = true
) {
	const cachedRecords = useSelect(
		( select ) => {
			return attachments
				.map( ( attachment ) =>
					attachment.id
						? ( select(
								coreStore
						  ).__experimentalGetEntityRecordNoResolver(
								'postType',
								'attachment',
								attachment.id
						  ) as RestAttachment | undefined )
						: undefined
				)
				.filter( ( attachment ) => attachment !== undefined );
		},
		[ attachments ]
	);

	if ( cachedRecords.length === attachments.length ) {
		enabled = false;
	}

	const { records, isResolving } = useEntityRecords< RestAttachment >(
		'postType',
		'attachment',
		{
			include: attachments.map( ( { id } ) => id ).join( ',' ),
			// eslint-disable-next-line camelcase
			per_page: -1,
			orderby: 'include',
		},
		{ enabled }
	);

	if (
		( isResolving || ! records ) &&
		cachedRecords.length !== attachments.length
	) {
		return EMPTY_ARRAY;
	}

	return attachments.map( ( attachment ) => {
		const media =
			records?.find( ( record ) => record.id === attachment.id ) ||
			cachedRecords.find( ( record ) => record.id === attachment.id );

		if ( media ) {
			// Always use the full URL, in case the block uses a sub-size.
			attachment.url = media.source_url;

			if ( media.mexp_filesize ) {
				attachment.filesize = media.mexp_filesize;
			}

			if ( media.mexp_filename ) {
				attachment.filename = media.mexp_filename;
			}

			attachment.additionalData = {
				mexp_blurhash: media.mexp_blurhash || undefined,
				mexp_dominant_color: media.mexp_dominant_color || undefined,
				featured_media:
					media.meta.mexp_generated_poster_id || undefined,
			};
		}

		return attachment as BulkOptimizationAttachmentData;
	} );
}

export function useBlockAttachments( clientId?: string ) {
	const { updateBlockAttributes } = useDispatch( blockEditorStore );
	const { editEntityRecord } = useDispatch( coreStore );

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

	const siteLogoId = useSelect( ( select ) => {
		const { canUser, getEditedEntityRecord } = select( coreStore );
		const canUserEdit = canUser( 'update', 'settings' );
		const siteSettings = canUserEdit
			? ( getEditedEntityRecord( 'root', 'site', undefined ) as Settings )
			: undefined;
		return canUserEdit ? siteSettings?.site_logo : undefined;
	}, [] );

	const blocks = useSelect(
		( select ) => {
			if ( ! clientId ) {
				return select( blockEditorStore )
					.getClientIdsWithDescendants()
					.map( ( id ) => select( blockEditorStore ).getBlock( id ) )
					.filter( ( block ) => block !== null );
			}

			const block = select( blockEditorStore ).getBlock( clientId );

			if ( ! block ) {
				return EMPTY_ARRAY;
			}

			if ( block.name === 'core/gallery' ) {
				return block.innerBlocks;
			}

			return [ block ];
		},
		[ clientId ]
	);

	let attachments = blocks
		.map( ( block ) => {
			const attachment: Partial< BulkOptimizationAttachmentData > = {
				filesize: 0,
				filename: '',
			};

			if ( block.name === 'core/image' && block.attributes.id ) {
				attachment.id = block.attributes.id;
				attachment.onChange = ( media: Partial< Attachment > ) => {
					void updateBlockAttributes( block.clientId, {
						id: media.id,
						url: media.url,
					} );
				};

				return attachment;
			}

			if (
				block.name === 'core/media-text' &&
				block.attributes.mediaId &&
				block.attributes.mediaType === 'image'
			) {
				attachment.id = block.attributes.mediaId;
				attachment.onChange = ( media: Partial< Attachment > ) => {
					void updateBlockAttributes( block.clientId, {
						mediaId: media.id,
						mediaUrl: media.url,
					} );
				};

				return attachment;
			}

			if (
				block.name === 'core/cover' &&
				block.attributes.id &&
				block.attributes.backgroundType === 'image'
			) {
				attachment.id = block.attributes.id;
				attachment.onChange = ( media: Partial< Attachment > ) => {
					void updateBlockAttributes( block.clientId, {
						id: media.id,
						url: media.url,
					} );
				};

				return attachment;
			}

			if ( block.name === 'core/post-featured-image' && featuredImage ) {
				attachment.id = featuredImage;
				attachment.onChange = ( media: Partial< Attachment > ) => {
					if ( media.id ) {
						setFeaturedImage( media.id );
					}
				};

				return attachment;
			}

			if ( block.name === 'core/site-logo' && siteLogoId ) {
				attachment.id = siteLogoId;
				attachment.onChange = ( media: Partial< Attachment > ) => {
					if ( ! media || ! media.id ) {
						return;
					}

					if ( block.attributes.shouldSyncIcon ) {
						void editEntityRecord( 'root', 'site', undefined, {
							site_icon: media.id,
						} );
					}

					void editEntityRecord( 'root', 'site', undefined, {
						site_logo: media.id,
					} );
				};

				return attachment;
			}

			return null;
		} )
		.filter( ( attachment ) => attachment !== null );

	if ( ! clientId && featuredImage ) {
		attachments.unshift( {
			filesize: 0,
			filename: '',
			id: featuredImage,
			onChange: ( media: Partial< Attachment > ) => {
				if ( media.id ) {
					setFeaturedImage( media.id );
				}
			},
		} );
	}

	/*
	 * De-duplicate attachments in the list.
	 *
	 * If the same image is used multiple times on a page, this allows updating all instances
	 * while showing it only once in the list.
	 *
	 * @param attachments Attachments list.
	 */
	attachments = attachments.reduce( ( acc, attachment ) => {
		const foundIndex = acc.findIndex( ( a ) => a.id === attachment.id );

		if ( foundIndex > -1 ) {
			acc[ foundIndex ].onChange = ( media ) => {
				acc[ foundIndex ].onChange?.( media );
				attachment.onChange?.( media );
			};
		} else {
			acc.push( attachment );
		}

		return acc;
	}, [] as Partial< BulkOptimizationAttachmentData >[] );

	// Avoid requests until site logo and featured image have been fetched.
	const attachmentsToQuery =
		siteLogoId !== undefined && featuredImage !== undefined
			? attachments
			: EMPTY_ARRAY;

	return useAttachmentsWithEntityRecords(
		attachmentsToQuery,
		attachmentsToQuery.length > 0
	);
}
