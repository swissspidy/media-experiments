/**
 * External dependencies
 */
import { store as uploadStore } from '@mexp/upload-media';

/**
 * WordPress dependencies
 */
import { isBlobURL } from '@wordpress/blob';
import { Notice } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { useSelect } from '@wordpress/data';

/**
 * Internal dependencies
 */
import { useIsUploadingByUrl } from '../utils/hooks';

interface UploadIndicatorProps {
	id: number;
	url?: string;
	poster?: string;
}

export function UploadIndicator( { id, url, poster }: UploadIndicatorProps ) {
	const isUploadingById = useSelect(
		( select ) =>
			id ? select( uploadStore ).isUploadingById( id ) : false,
		[ id ]
	);
	const isUploadingByUrl = useIsUploadingByUrl( url );
	const isPosterUploadingByUrl = useIsUploadingByUrl( poster );
	const isUploading = isUploadingById || isUploadingByUrl;

	const isPosterUploading = Boolean(
		isPosterUploadingByUrl || ( poster && isBlobURL( poster ) )
	);

	return (
		<>
			{ isUploading && (
				<Notice isDismissible={ false }>
					<p>{ __( 'Upload in progress', 'media-experiments' ) }</p>
				</Notice>
			) }
			{ isPosterUploading && (
				<Notice isDismissible={ false }>
					<p>
						{ __(
							'Poster Upload in progress',
							'media-experiments'
						) }
					</p>
				</Notice>
			) }
		</>
	);
}
