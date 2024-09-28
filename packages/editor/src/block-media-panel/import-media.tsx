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
import { useEffect, useState } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { useIsUploadingByUrl, useMediaSourceTerms } from '../utils/hooks';

interface ImportMediaProps {
	url?: string;
	onChange: ( attachment: Partial< Attachment > ) => void;
	allowedTypes?: string[];
}

export function ImportMedia( {
	url,
	onChange,
	allowedTypes,
}: ImportMediaProps ) {
	const { baseControlProps, controlProps } = useBaseControlProps( {
		__nextHasNoMarginBottom: true,
	} );

	const { addItemFromUrl } = useDispatch( uploadStore );
	const { createErrorNotice } = useDispatch( noticesStore );
	const isUploading = useIsUploadingByUrl( url );

	const mediaSourceTerms = useMediaSourceTerms();

	const [ canImport, setCanImport ] = useState( false );

	// If an image is externally hosted, try to fetch the image data. This may
	// fail if the image host doesn't allow CORS with the domain. If it works,
	// we can enable the import button.
	useEffect( () => {
		if ( canImport || ! url || isBlobURL( url ) ) {
			return;
		}

		// Avoid cache, which seems to help avoid CORS problems.
		fetch( url.includes( '?' ) ? url : url + '?' )
			.then( ( response ) => response.blob() )
			.then( () => setCanImport( true ) )
			// Do nothing, cannot upload.
			// Do nothing, cannot upload.
			.catch( () => {} );
	}, [ url, canImport ] );

	if ( ! url || isBlobURL( url ) || ! canImport ) {
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
					'This file is not hosted on your site. Do you want to import it to your media library?',
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
