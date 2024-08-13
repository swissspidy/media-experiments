/**
 * External dependencies
 */
import type { Attachment } from '@mexp/media-utils';
import { store as uploadStore } from '@mexp/upload-media';

/**
 * WordPress dependencies
 */
import { isBlobURL } from '@wordpress/blob';
import { useDispatch, useSelect } from '@wordpress/data';
import { store as editorStore } from '@wordpress/editor';
import {
	BaseControl,
	Button,
	useBaseControlProps,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { useAttachment, useIsUploadingByUrl } from '../utils/hooks';

interface MuteVideoProps {
	id: number;
	url: string;
	poster?: string;
	onChange: ( attachment: Partial< Attachment > ) => void;
}

export function MuteVideo( { id, url, poster, onChange }: MuteVideoProps ) {
	const { baseControlProps, controlProps } = useBaseControlProps( {} );

	const post = useAttachment( id );

	const isUploading = useIsUploadingByUrl( url ) || isBlobURL( url );

	const { muteExistingVideo } = useDispatch( uploadStore );
	const currentPostId = useSelect(
		( select ) => select( editorStore ).getCurrentPostId(),
		[]
	);

	if ( ! post || post.mexp_is_muted ) {
		return null;
	}

	const onClick = () => {
		// TODO: Figure out why poster is not
		void muteExistingVideo( {
			id: post.id,
			url,
			poster,
			fileName: post.mexp_filename || undefined,
			onChange: ( [ media ] ) => onChange( media ),
			onSuccess: ( [ media ] ) => onChange( media ),
			blurHash: post?.mexp_blurhash,
			dominantColor: post?.mexp_dominant_color,
			generatedPosterId: post?.meta.mexp_generated_poster_id,
			additionalData: {
				post: currentPostId,
			},
		} );
	};

	return (
		<BaseControl { ...baseControlProps }>
			<BaseControl.VisualLabel>
				{ __( 'Mute Video', 'media-experiments' ) }
			</BaseControl.VisualLabel>
			<p>
				{ __(
					'Mute the video by completely removing the audio information, reducing the file size.',
					'media-experiments'
				) }
			</p>
			<Button
				variant="primary"
				onClick={ onClick }
				disabled={ isUploading }
				{ ...controlProps }
			>
				{ __( 'Remove audio channel', 'media-experiments' ) }
			</Button>
		</BaseControl>
	);
}
