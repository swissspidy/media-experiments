import { file, image, upload, video } from '@wordpress/icons';
import { useDispatch, useSelect } from '@wordpress/data';
import { __ } from '@wordpress/i18n';
import { DropdownMenu } from '@wordpress/components';

import { getMediaTypeFromMimeType } from '@mexp/media-utils';
import { store as uploadStore, UploadError } from '@mexp/upload-media';

const EMPTY_ARRAY: never[] = [];

function getItemForMimeType( mimeType: string ) {
	let icon;
	const mediaType = getMediaTypeFromMimeType( mimeType );
	switch ( mediaType ) {
		case 'image':
			icon = image;
			break;
		case 'video':
			icon = video;
			break;
		default:
			icon = file;
	}

	return icon;
}

export function UploadStatusIndicator() {
	const { cancelItem } = useDispatch( uploadStore );
	const { isUploading, items } = useSelect(
		( select ) => {
			const queueItems = select( uploadStore ).getItems();
			return {
				isUploading: select( uploadStore ).isUploading(),
				items: queueItems.length
					? queueItems.map( ( item ) => {
							return {
								icon: getItemForMimeType(
									item.file.type || 'unknown'
								),
								title:
									item.file.name ||
									__(
										'(Untitled file)',
										'media-experiments'
									),
								onClick: () =>
									cancelItem(
										item.id,
										new UploadError( {
											code: 'UPLOAD_CANCELLED_MANUALLY',
											message:
												'File upload was cancelled',
											file: item.file,
										} )
									),
							};
					  } )
					: EMPTY_ARRAY,
			};
		},
		[ cancelItem ]
	);

	if ( ! isUploading ) {
		return (
			<DropdownMenu
				controls={ [
					{
						title: __(
							'No uploads in progress',
							'media-experiments'
						),
						isDisabled: true,
					},
				] }
				icon={ upload }
				label={ __( 'Uploads', 'media-experiments' ) }
			/>
		);
	}

	return (
		<DropdownMenu
			controls={ items }
			icon={ upload }
			label={ __( 'Uploads', 'media-experiments' ) }
		/>
	);
}
