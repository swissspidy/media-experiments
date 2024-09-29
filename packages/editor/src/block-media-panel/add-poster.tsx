/**
 * External dependencies
 */
import { store as uploadStore } from '@mexp/upload-media';
import type { RestAttachment } from '@mexp/media-utils';

/**
 * WordPress dependencies
 */
import {
	BaseControl,
	Button,
	useBaseControlProps,
} from '@wordpress/components';
import { useEffect, useState } from '@wordpress/element';
import { isBlobURL } from '@wordpress/blob';
import { __ } from '@wordpress/i18n';
import { useDispatch } from '@wordpress/data';
import { useEntityRecord } from '@wordpress/core-data';
import apiFetch from '@wordpress/api-fetch';

/**
 * Internal dependencies
 */
import { useIsUploadingByUrl, useMediaSourceTerms } from '../utils/hooks';

interface AddPosterProps {
	attributes: {
		id?: number;
		poster?: string;
		src: string;
	};
	setAttributes: ( attributes: Record< string, unknown > ) => void;
}

export function AddPoster( { attributes, setAttributes }: AddPosterProps ) {
	const { baseControlProps, controlProps } = useBaseControlProps( {
		__nextHasNoMarginBottom: true,
	} );

	const [ posterId, setPosterId ] = useState< number | undefined >();

	const { record: attachment } = useEntityRecord< RestAttachment | null >(
		'postType',
		'attachment',
		attributes.id || 0
	);

	const { record: poster } = useEntityRecord< RestAttachment | null >(
		'postType',
		'attachment',
		posterId || 0
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

	const mediaSourceTerms = useMediaSourceTerms();

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
				mexp_media_source: mediaSourceTerms[ 'poster-generation' ],
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
					variant="secondary"
					onClick={ restorePoster }
					disabled={ isUploading }
					{ ...controlProps }
				>
					{ __( 'Restore poster', 'media-experiments' ) }
				</Button>
			) : (
				<Button
					variant="secondary"
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
