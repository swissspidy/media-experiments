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
	useEntityRecords,
} from '@wordpress/core-data';
import { useDispatch, useSelect } from '@wordpress/data';
import { isBlobURL } from '@wordpress/blob';
import { store as editorStore } from '@wordpress/editor';
import { store as blockEditorStore } from '@wordpress/block-editor';
import { store as blocksStore } from '@wordpress/blocks';

/**
 * Internal dependencies
 */
import type {
	BulkOptimizationAttachmentData,
	MediaSourceTerm,
	RestBaseRecord,
	VideoBlock,
} from '../types';

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

const EMPTY_OBJECT = {} as Record< MediaSourceTerm, number >;

export function useMediaSourceTerms() {
	return useSelect( ( select ) => {
		const siteData = select( coreStore ).getEntityRecord<
			// @ts-ignore
			RestBaseRecord | undefined
		>( 'root', '__unstableBase', undefined, {
			_fields: [ 'media_source_terms' ],
		} );

		if ( ! siteData ) {
			return EMPTY_OBJECT;
		}

		return siteData.media_source_terms;
	}, [] );
}

const EMPTY_ARRAY: never[] = [];

/**
 * For a list of attachment objects, enriches them with server-side data.
 *
 * Since the number of items in the list can change, this uses
 * `__experimentalGetEntityRecordNoResolver()` in addition to `useEntityRecords`
 * to avoid unnecessary HTTP requests when all the individual items have been
 * previously fetched already.
 *
 * @param attachments List of attachments.
 * @param enabled     Whether to actually send requests.
 */
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

	// Add server-side data but remove the ones not found on the server anymore.
	return attachments
		.map( ( attachment ) => {
			const media =
				records?.find( ( record ) => record.id === attachment.id ) ||
				cachedRecords.find( ( record ) => record.id === attachment.id );

			if ( media ) {
				// Always use the full URL, in case the block uses a sub-size.
				attachment.url = media.source_url;

				// Always use the original ID and URL in case this image is already an optimized version.
				if ( media.mexp_original_url ) {
					attachment.url = media.mexp_original_url;
				}

				if ( media.mexp_filesize ) {
					attachment.filesize = media.mexp_filesize;
				}

				if ( media.mexp_filename ) {
					attachment.filename = media.mexp_filename;
				}

				attachment.additionalData = {
					meta: {
						mexp_original_id:
							media.meta.mexp_original_id || attachment.id,
						mexp_blurhash: media.mexp_blurhash || undefined,
						mexp_dominant_color:
							media.mexp_dominant_color || undefined,
						featured_media:
							media.meta.mexp_generated_poster_id || undefined,
					},
				};

				return attachment as BulkOptimizationAttachmentData;
			}
			return undefined;
		} )
		.filter( ( attachment ) => attachment !== undefined );
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

export function useIsGifVariation( clientId?: string ) {
	return useSelect(
		( select ) => {
			if ( ! clientId ) {
				return false;
			}
			const { getBlockName, getBlockAttributes } =
				select( blockEditorStore );
			const name = getBlockName( clientId );

			if ( ! name ) {
				return false;
			}

			const activeBlockVariation = select(
				blocksStore
			).getActiveBlockVariation(
				name,
				getBlockAttributes( clientId ) as VideoBlock[ 'attributes' ]
			);
			return 'gif' === activeBlockVariation?.name;
		},
		[ clientId ]
	);
}
