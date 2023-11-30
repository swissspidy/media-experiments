import { useEntityRecord } from '@wordpress/core-data';
import { useSelect } from '@wordpress/data';

import { store as uploadStore, type RestAttachment } from '@mexp/upload-media';
import { isBlobURL } from '@wordpress/blob';

export function useAttachment( id?: number ) {
	const { record } = useEntityRecord( 'postType', 'attachment', id || 0 );
	return record as RestAttachment | null;
}

export function useIsUploadingById( id?: number ) {
	return useSelect(
		( select ) =>
			id ? select( uploadStore ).isUploadingById( id ) : false,
		[ id ]
	);
}

export function useIsUploadingByUrl( url?: string ) {
	return useSelect(
		( select ) => {
			if ( ! url ) {
				return false;
			}

			const isUploading = select( uploadStore ).isUploadingByUrl( url );

			return isUploading || isBlobURL( url );
		},
		[ url ]
	);
}
