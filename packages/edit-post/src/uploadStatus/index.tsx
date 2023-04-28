import { store as uploadStore } from '@mexp/upload-media';
import { getMediaTypeFromMimeType } from '@mexp/media-utils';

import { createPortal, useLayoutEffect, useRef } from '@wordpress/element';
import {
	subscribe,
	dispatch as globalDispatch,
	select as globalSelect,
	useDispatch,
	useSelect,
} from '@wordpress/data';
import { registerPlugin } from '@wordpress/plugins';
import { store as coreStore } from '@wordpress/core-data';
import { store as editorStore } from '@wordpress/editor';
import { store as editPostStore } from '@wordpress/edit-post';
import { DropdownMenu } from '@wordpress/components';
import { file, image, video, upload } from '@wordpress/icons';
import { __ } from '@wordpress/i18n';

const EMPTY_ARRAY = [];

function getItemForMimeType(mimeType) {
	let icon;
	const mediaType = getMediaTypeFromMimeType(mimeType);
	switch (mediaType) {
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

function UploadStatusIndicator() {
	const { cancelItem } = useDispatch(uploadStore);
	const { isUploading, items } = useSelect((select) => {
		return {
			isUploading: select(uploadStore).isUploading(),
			items:
				select(uploadStore)
					.getItems()
					.map((item) => {
						return {
							icon: getItemForMimeType(
								item.file.type || 'unknown'
							),
							title:
								item.file.name ||
								__('(Untitled file)', 'media-experiments'),
							onClick: () => cancelItem(item.id),
						};
					}) || EMPTY_ARRAY,
		};
	}, []);

	if (!isUploading) {
		return (
			<DropdownMenu
				controls={[
					{
						title: 'No uploads in progress',
						isDisabled: true,
					},
				]}
				icon={upload}
				label={__('Uploads', 'media-experiments')}
			/>
		);
	}

	return (
		<DropdownMenu
			controls={items}
			icon={upload}
			label={__('Uploads', 'media-experiments')}
		/>
	);
}

function WrappedUploadStatusIndicator() {
	const root = useRef<HTMLDivElement>(null);
	const referenceNode = useRef<HTMLDivElement>(null);

	const { isEditedPostSaveable, isViewable } = useSelect(
		(select) => ({
			isEditedPostSaveable: select(editorStore).isEditedPostSaveable(),
			isViewable: select(coreStore).getPostType(
				select(editorStore).getEditedPostAttribute('type')
			)?.viewable,
		}),
		[]
	);

	useLayoutEffect(() => {
		// The upload status indicator should always be inserted right before any other buttons.
		referenceNode.current = document.querySelector(
			'.edit-post-header__settings'
		);

		if (referenceNode.current) {
			if (!root.current) {
				root.current = document.createElement('div');
				root.current.className = 'media-experiments-upload-status';
			}

			referenceNode.current.prepend(root.current);
		}

		return () => {
			if (referenceNode.current && root.current) {
				referenceNode.current.removeChild(root.current);
				referenceNode.current = null;
			}
		};

		// The button should be "refreshed" whenever settings in the post editor header are re-rendered.
		// The following properties may indicate a change in the toolbar layout:
		// - Viewable property gets defined once the toolbar has been rendered.
		// - When saveable property changes, the toolbar is reshuffled heavily.
	}, [isEditedPostSaveable, isViewable]);

	return root.current
		? createPortal(<UploadStatusIndicator />, root.current)
		: null;
}

registerPlugin('media-experiments-upload-status', {
	render: WrappedUploadStatusIndicator,
});

subscribe(() => {
	// Requires patched Gutenberg version.
	globalDispatch(editPostStore).setIsUploading?.(
		globalSelect(uploadStore).isUploading()
	);
}, uploadStore);
