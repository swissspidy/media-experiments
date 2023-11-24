import { useEntityRecord } from '@wordpress/core-data';
import { useSelect } from '@wordpress/data';

import { store as uploadStore, type RestAttachment } from '@mexp/upload-media';

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
