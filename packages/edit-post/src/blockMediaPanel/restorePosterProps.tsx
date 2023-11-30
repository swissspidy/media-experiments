import {
	BaseControl,
	Button,
	useBaseControlProps,
} from '@wordpress/components';
import { useEffect, useState } from '@wordpress/element';
import { isBlobURL } from '@wordpress/blob';
import { __ } from '@wordpress/i18n';

import { useAttachment, useIsUploadingByUrl } from '../utils/hooks';

interface RestorePosterProps {
	attributes: {
		id?: number;
		poster?: string;
		src: string;
	};
	setAttributes: ( attributes: Record< string, unknown > ) => void;
}

export function RestorePoster( {
	attributes,
	setAttributes,
}: RestorePosterProps ) {
	const { baseControlProps, controlProps } = useBaseControlProps( {} );

	const [ posterId, setPosterId ] = useState< number | undefined >();

	const attachment = useAttachment( attributes.id );
	const poster = useAttachment( posterId );

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

	if ( attributes.poster || isUploading || ! poster ) {
		return null;
	}

	const onClick = () => {
		setAttributes( {
			poster: poster.source_url,
		} );
	};

	return (
		<BaseControl { ...baseControlProps }>
			<BaseControl.VisualLabel>
				{ __( 'Missing poster', 'media-experiments' ) }
			</BaseControl.VisualLabel>
			<p>
				{ __(
					'Adding a poster image to videos is recommended, but your video is currently lacking one. However, you can restore the default auto-generated poster.',
					'media-experiments'
				) }
			</p>
			<Button variant="primary" onClick={ onClick } { ...controlProps }>
				{ __( 'Restore Poster', 'media-experiments' ) }
			</Button>
		</BaseControl>
	);
}
