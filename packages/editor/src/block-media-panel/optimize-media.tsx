/**
 * External dependencies
 */
import type { MouseEvent } from 'react';

/**
 * WordPress dependencies
 */
import {
	BaseControl,
	Button,
	useBaseControlProps,
} from '@wordpress/components';
import { store as noticesStore } from '@wordpress/notices';
import { useDispatch, useSelect } from '@wordpress/data';
import { store as editorStore } from '@wordpress/editor';
import { isBlobURL } from '@wordpress/blob';
import { __, sprintf } from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';

import type { Attachment } from '@mexp/media-utils';
import { store as uploadStore } from '@mexp/upload-media';

/**
 * Internal dependencies
 */
import { useAttachment, useIsUploadingById } from '../utils/hooks';
import { ApprovalDialog } from '../components/approval-dialog';

interface OptimizeMediaProps {
	id: number;
	url?: string;
	poster?: string;
	onSuccess: ( attachment: Partial< Attachment > ) => void;
	label?: string;
}

export function OptimizeMedia( {
	id,
	url,
	poster,
	onSuccess,
	label,
}: OptimizeMediaProps ) {
	const { baseControlProps, controlProps } = useBaseControlProps( {} );

	const attachment = useAttachment( id );
	const { optimizeExistingItem } = useDispatch( uploadStore );
	const isUploading = useIsUploadingById( id );
	const currentPostId = useSelect(
		( select ) => select( editorStore ).getCurrentPostId(),
		[]
	);
	const { createSuccessNotice, createErrorNotice } =
		useDispatch( noticesStore );

	if (
		! attachment ||
		! url ||
		isBlobURL( url ) ||
		attachment.mexp_media_source.length > 0
	) {
		return null;
	}

	const onClick = ( evt: MouseEvent< HTMLButtonElement > ) => {
		void optimizeExistingItem( {
			id,
			url: attachment.source_url || url,
			fileName: attachment.mexp_filename || undefined,
			poster,
			onSuccess: ( [ media ] ) => {
				onSuccess( media );
				void createSuccessNotice(
					__( 'File successfully optimized.', 'media-experiments' ),
					{
						type: 'snackbar',
					}
				);

				void apiFetch( {
					path: `/wp/v2/media/${ attachment.id }`,
					data: {
						meta: {
							mexp_optimized_id: media.id,
						},
					},
					method: 'POST',
				} );
			},
			onError: ( err: Error ) => {
				void createErrorNotice(
					sprintf(
						/* translators: %s: error message */
						__(
							'There was an error optimizing the file: %s',
							'media-experiments'
						),
						err.message
					),
					{
						type: 'snackbar',
					}
				);
			},
			blurHash: attachment.mexp_blurhash,
			dominantColor: attachment.mexp_dominant_color,
			generatedPosterId: attachment.meta.mexp_generated_poster_id,
			additionalData: {
				post: currentPostId,
				mexp_media_source:
					window.mediaExperiments.mediaSourceTerms[
						'media-optimization'
					],
			},
			startTime: evt.timeStamp,
		} );
	};

	return (
		<>
			<BaseControl { ...baseControlProps }>
				<BaseControl.VisualLabel>
					{ label || __( 'Optimize media', 'media-experiments' ) }
				</BaseControl.VisualLabel>
				<p>
					{ __(
						'Maybe you can make the file a bit smaller?',
						'media-experiments'
					) }
				</p>
				<Button
					variant="secondary"
					onClick={ onClick }
					disabled={ isUploading }
					{ ...controlProps }
				>
					{ __( 'Compress', 'media-experiments' ) }
				</Button>
			</BaseControl>
			<ApprovalDialog id={ attachment.id } />
		</>
	);
}
