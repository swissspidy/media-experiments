import {
	BaseControl,
	Button,
	useBaseControlProps,
} from '@wordpress/components';
import { useEffect, useState } from '@wordpress/element';
import { isBlobURL } from '@wordpress/blob';
import { __ } from '@wordpress/i18n';
import { useDispatch, useSelect } from '@wordpress/data';
import { store as editorStore } from '@wordpress/editor';
import apiFetch from '@wordpress/api-fetch';

import { store as uploadStore } from '@mexp/upload-media';

import { useAttachment, useIsUploadingByUrl } from '../utils/hooks';

interface AddPosterProps {
	attributes: {
		id?: number;
		poster?: string;
		src: string;
	};
	setAttributes: ( attributes: Record< string, unknown > ) => void;
}

export function AddPoster( { attributes, setAttributes }: AddPosterProps ) {
	const { baseControlProps, controlProps } = useBaseControlProps( {} );

	const [ posterId, setPosterId ] = useState< number | undefined >();

	const attachment = useAttachment( attributes.id );
	const poster = useAttachment( posterId );

	const currentPostId = useSelect(
		( select ) => select( editorStore ).getCurrentPostId(),
		[]
	);

	const { addPosterForExistingVideo } = useDispatch( uploadStore );

	useEffect( () => {
		if ( ! attachment ) {
			return;
		}

		setPosterId(
			attachment.featured_media ||
				attachment.meta.mexp_generated_poster_id
		);
	}, [ attachment ] );

	const url = attributes.src;
	const isUploading = useIsUploadingByUrl( url ) || isBlobURL( url );

	if ( ! attachment || ( attributes.poster && ! isUploading ) ) {
		return null;
	}

	const restorePoster = () => {
		if ( poster ) {
			setAttributes( {
				poster: poster.source_url,
			} );
		}
	};

	const generatePoster = () => {
		void addPosterForExistingVideo( {
			id: attachment?.id || undefined,
			url: attributes.src,
			fileName: attachment?.mexp_filename || undefined,
			onChange: ( [ media ] ) =>
				setAttributes( {
					poster: media.url,
				} ),
			onSuccess: ( [ media ] ) => {
				void apiFetch( {
					path: `/wp/v2/media/${ attachment.id }`,
					data: {
						featured_media: media.id,
						meta: {
							meta: {
								mexp_generated_poster_id: media.id,
							},
						},
					},
					method: 'POST',
				} );
			},
			additionalData: {
				post: currentPostId,
				mexp_media_source:
					window.mediaExperiments.mediaSourceTerms[
						'poster-generation'
					],
			},
		} );
	};

	return (
		<BaseControl { ...baseControlProps }>
			<BaseControl.VisualLabel>
				{ __( 'Missing poster', 'media-experiments' ) }
			</BaseControl.VisualLabel>
			<p>
				{ __(
					'Adding a poster image to videos is recommended, but your video is currently lacking one.',
					'media-experiments'
				) }
			</p>
			{ poster ? (
				<Button
					variant="primary"
					onClick={ restorePoster }
					disabled={ isUploading }
					{ ...controlProps }
				>
					{ __( 'Restore poster', 'media-experiments' ) }
				</Button>
			) : (
				<Button
					variant="primary"
					onClick={ generatePoster }
					disabled={ isUploading }
					{ ...controlProps }
				>
					{ __( 'Generate poster', 'media-experiments' ) }
				</Button>
			) }
		</BaseControl>
	);
}
