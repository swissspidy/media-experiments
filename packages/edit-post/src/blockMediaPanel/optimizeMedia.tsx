import type { MouseEvent } from 'react';
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

import { type Attachment, store as uploadStore } from '@mexp/upload-media';

import { useAttachment, useIsUploadingById } from '../utils/hooks';
import { ApprovalDialog } from '../components/approvalDialog';

interface OptimizeMediaProps {
	id: number;
	url?: string;
	poster?: string;
	onSuccess: ( attachment: Partial< Attachment > ) => void;
}

export function OptimizeMedia( {
	id,
	url,
	poster,
	onSuccess,
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
			poster,
			onSuccess: ( [ media ] ) => {
				onSuccess( media );
				void createSuccessNotice(
					__( 'File successfully optimized.', 'media-experiments' ),
					{
						type: 'snackbar',
					}
				);
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
			},
			startTime: evt.timeStamp,
		} );
	};

	// TODO: This needs some (async) checks first to see whether optimization is needed.

	return (
		<>
			<BaseControl { ...baseControlProps }>
				<BaseControl.VisualLabel>
					{ __( 'Optimize media', 'media-experiments' ) }
				</BaseControl.VisualLabel>
				<p>
					{ __(
						'Maybe you can make the file a bit smaller?',
						'media-experiments'
					) }
				</p>
				<Button
					variant="primary"
					onClick={ onClick }
					disabled={ isUploading }
					{ ...controlProps }
				>
					{ __( 'Optimize', 'media-experiments' ) }
				</Button>
			</BaseControl>
			<ApprovalDialog id={ attachment.id } />
		</>
	);
}
