/**
 * WordPress dependencies
 */
import { isBlobURL } from '@wordpress/blob';
import { Fragment } from '@wordpress/element';
import { Notice } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { useIsUploadingById, useIsUploadingByUrl } from '../utils/hooks';

interface UploadIndicatorProps {
	id: number;
	url?: string;
	poster?: string;
}

export function UploadIndicator( { id, url, poster }: UploadIndicatorProps ) {
	const isUploadingById = useIsUploadingById( id );
	const isUploadingByUrl = useIsUploadingByUrl( url );
	const isPosterUploadingByUrl = useIsUploadingByUrl( poster );
	const isUploading = isUploadingById || isUploadingByUrl;

	const isPosterUploading = Boolean(
		isPosterUploadingByUrl || ( poster && isBlobURL( poster ) )
	);

	return (
		<Fragment>
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
		</Fragment>
	);
}
