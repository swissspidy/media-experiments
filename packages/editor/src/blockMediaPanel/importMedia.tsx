import {
	BaseControl,
	Button,
	useBaseControlProps,
} from '@wordpress/components';
import { useDispatch, useSelect } from '@wordpress/data';
import { store as editorStore } from '@wordpress/editor';
import { isBlobURL } from '@wordpress/blob';
import { __ } from '@wordpress/i18n';

import { type Attachment, store as uploadStore } from '@mexp/upload-media';

import { useIsUploadingByUrl } from '../utils/hooks';

interface ImportMediaProps {
	url?: string;
	onChange: ( attachment: Partial< Attachment > ) => void;
}

export function ImportMedia( { url, onChange }: ImportMediaProps ) {
	const { baseControlProps, controlProps } = useBaseControlProps( {} );

	const { addItemFromUrl } = useDispatch( uploadStore );
	const isUploading = useIsUploadingByUrl( url );
	const currentPostId = useSelect(
		( select ) => select( editorStore ).getCurrentPostId(),
		[]
	);

	if ( ! url || isBlobURL( url ) ) {
		return null;
	}

	const onClick = () => {
		void addItemFromUrl( {
			url,
			onChange: ( [ media ] ) => onChange( media ),
			additionalData: {
				post: currentPostId,
			},
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
				variant="primary"
				onClick={ onClick }
				disabled={ isUploading }
				{ ...controlProps }
			>
				{ __( 'Import', 'media-experiments' ) }
			</Button>
		</BaseControl>
	);
}
