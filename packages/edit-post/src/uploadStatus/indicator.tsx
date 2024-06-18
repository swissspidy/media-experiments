import { file, image, upload, video } from '@wordpress/icons';
import { useDispatch, useSelect } from '@wordpress/data';
import { __, _n, sprintf } from '@wordpress/i18n';
import { DropdownMenu } from '@wordpress/components';
import { useEffect } from '@wordpress/element';
import { store as editorStore } from '@wordpress/editor';

import { UploadError, store as uploadStore } from '@mexp/upload-media';
import { getMediaTypeFromMimeType } from '@mexp/media-utils';

import { UnfinishedUploadsWarning } from './unfinishedUploadsWarning';

const EMPTY_ARRAY: never[] = [];

function getIconForMimeType( mimeType: string ) {
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
								icon: getIconForMimeType(
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
	const {
		lockPostSaving,
		lockPostAutosaving,
		unlockPostSaving,
		unlockPostAutosaving,
	} = useDispatch( editorStore );

	// See https://github.com/WordPress/gutenberg/pull/41120#issuecomment-1246914529
	// TODO: What happens to image block when deleting it during uploading?
	// TODO: Disable "Save Draft" as well.
	useEffect( () => {
		if ( isUploading ) {
			void lockPostSaving( 'media-experiments' );
			void lockPostAutosaving( 'media-experiments' );
		} else {
			void unlockPostSaving( 'media-experiments' );
			void unlockPostAutosaving( 'media-experiments' );
		}
	}, [
		isUploading,
		lockPostAutosaving,
		lockPostSaving,
		unlockPostAutosaving,
		unlockPostSaving,
	] );

	if ( ! isUploading ) {
		return (
			<>
				<UnfinishedUploadsWarning />
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
					label={ __(
						'Uploads (0 in progress)',
						'media-experiments'
					) }
				/>
			</>
		);
	}

	return (
		<>
			<UnfinishedUploadsWarning />
			<DropdownMenu
				controls={ items }
				icon={ upload }
				label={ sprintf(
					/* translators: %d: number of files being uploaded. */
					_n(
						'Uploads (%d in progress)',
						'Uploads (%d in progress)',
						items.length,
						'media-experiments'
					),
					items.length
				) }
			/>
		</>
	);
}
