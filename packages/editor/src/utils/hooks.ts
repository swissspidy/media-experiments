import { useEntityProp, useEntityRecord } from '@wordpress/core-data';
import { useSelect } from '@wordpress/data';

import { type RestAttachment } from '@mexp/media-utils';
import { store as uploadStore } from '@mexp/upload-media';
import { isBlobURL } from '@wordpress/blob';
import { store as editorStore } from '@wordpress/editor';

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

export function useFeaturedImageAttachment() {
	const { type: postType, id: postId } = useSelect(
		( select ) => select( editorStore ).getCurrentPost(),
		[]
	);

	const [ featuredImage, setFeaturedImage ] = useEntityProp(
		'postType',
		postType,
		'featured_media',
		postId as number
	) as [ number | undefined, ( id: number ) => void, unknown ];

	const attachment = useAttachment( featuredImage );

	return {
		featuredImage,
		setFeaturedImage,
		attachment,
	};
}
