/**
 * External dependencies
 */
import { store as uploadStore } from '@mexp/upload-media';

/**
 * WordPress dependencies
 */
import type { BlockEditProps } from '@wordpress/blocks';
import { isBlobURL } from '@wordpress/blob';
import { useDispatch, useSelect } from '@wordpress/data';
import { store as editorStore } from '@wordpress/editor';
import { __, _x } from '@wordpress/i18n';
import {
	BaseControl,
	Button,
	useBaseControlProps,
} from '@wordpress/components';
import { useLayoutEffect } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { useAttachment, useIsUploadingByUrl } from '../utils/hooks';
import type { VideoBlock } from './types';

type GenerateSubtitlesProps = VideoBlock &
	Pick< BlockEditProps< VideoBlock[ 'attributes' ] >, 'setAttributes' >;

export function GenerateSubtitles( {
	attributes,
	setAttributes,
}: GenerateSubtitlesProps ) {
	const { baseControlProps, controlProps } = useBaseControlProps( {} );

	const post = useAttachment( attributes.id );

	const url = attributes.src;
	const isUploading = useIsUploadingByUrl( url ) || isBlobURL( url );

	const { addSubtitlesForExistingVideo } = useDispatch( uploadStore );
	const currentPostId = useSelect(
		( select ) => select( editorStore ).getCurrentPostId(),
		[]
	);

	const hasTracks = attributes.tracks.length > 0;

	// Force-show subtitles in the video player so user immediately sees result.
	useLayoutEffect( () => {
		if ( ! hasTracks ) {
			return;
		}

		const editorCanvas =
			(
				( document.querySelector(
					'iframe[name="editor-canvas"]'
				) as HTMLIFrameElement ) || null
			)?.contentDocument || document;

		const videoPlayer = editorCanvas.querySelector(
			`video[src="${ url }"]`
		) as HTMLVideoElement | null;

		if ( videoPlayer && videoPlayer.textTracks?.[ 0 ] ) {
			videoPlayer.textTracks[ 0 ].mode = 'showing';
		}
	}, [ url, hasTracks ] );

	if ( post?.mexp_is_muted || hasTracks ) {
		return null;
	}

	const onClick = () => {
		void addSubtitlesForExistingVideo( {
			id: post?.id || undefined,
			url: attributes.src,
			fileName: post?.mexp_filename || undefined,
			onChange: ( [ media ] ) =>
				setAttributes( {
					tracks: [
						{
							src: media.url,
							label: _x(
								'Captions',
								'Text track label',
								'media-experiments'
							),
							srcLang: 'en', // TODO: Make customizable.
							kind: 'subtitles',
						},
					],
				} ),
			additionalData: {
				post: currentPostId,
				mexp_media_source:
					window.mediaExperiments.mediaSourceTerms[
						'subtitles-generation'
					],
			},
		} );
	};

	return (
		<BaseControl { ...baseControlProps }>
			<BaseControl.VisualLabel>
				{ __( 'Accessibility', 'media-experiments' ) }
			</BaseControl.VisualLabel>
			<p>
				{ __(
					'Use AI to automatically create subtitles for this video.',
					'media-experiments'
				) }
			</p>
			<Button
				variant="primary"
				onClick={ onClick }
				disabled={ isUploading }
				{ ...controlProps }
			>
				{ __( 'Generate subtitles', 'media-experiments' ) }
			</Button>
		</BaseControl>
	);
}
