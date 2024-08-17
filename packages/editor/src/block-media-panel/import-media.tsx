/**
 * External dependencies
 */
import type { Attachment } from '@mexp/media-utils';
import { store as uploadStore } from '@mexp/upload-media';

/**
 * WordPress dependencies
 */
import {
	BaseControl,
	Button,
	useBaseControlProps,
} from '@wordpress/components';
import { useDispatch } from '@wordpress/data';
import { isBlobURL } from '@wordpress/blob';
import { __, sprintf } from '@wordpress/i18n';
import { store as noticesStore } from '@wordpress/notices';

/**
 * Internal dependencies
 */
import { useIsUploadingByUrl, useMediaSourceTerms } from '../utils/hooks';

interface ImportMediaProps {
	url?: string;
	onChange: ( attachment: Partial< Attachment > ) => void;
	allowedTypes?: string[];
}

export function ImportMedia( { url, onChange, allowedTypes }: ImportMediaProps ) {
	const { baseControlProps, controlProps } = useBaseControlProps( {} );

	const { addItemFromUrl } = useDispatch( uploadStore );
	const { createErrorNotice } = useDispatch( noticesStore );
	const isUploading = useIsUploadingByUrl( url );

	const mediaSourceTerms = useMediaSourceTerms();

	if ( ! url || isBlobURL( url ) ) {
		return null;
	}

	const onClick = () => {
		void addItemFromUrl( {
			url,
			onChange: ( [ media ] ) => onChange( media ),
			onError: ( err: Error ) => {
				void createErrorNotice(
					sprintf(
						/* translators: %s: error message */
						__(
							'There was an error importing the file: %s',
							'media-experiments'
						),
						err.message
					),
					{
						type: 'snackbar',
					}
				);
			},
			additionalData: {
				mexp_media_source: mediaSourceTerms[ 'subtitles-generation' ],
			},
			allowedTypes,
		} );
	};

	return (
		<BaseControl { ...baseControlProps }>
			<BaseControl.VisualLabel>
				{ __( 'Import external media', 'media-experiments' ) }
			</BaseControl.VisualLabel>
			<p>
				{ __(
					'This file is not hosted on your site. Do you want to import it to your media library? Note: requires CORS.',
					'media-experiments'
				) }
			</p>
			<Button
				variant="secondary"
				onClick={ onClick }
				disabled={ isUploading }
				{ ...controlProps }
			>
				{ __( 'Import', 'media-experiments' ) }
			</Button>
		</BaseControl>
	);
}
