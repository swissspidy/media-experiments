import { Fragment } from '@wordpress/element';
import { addFilter } from '@wordpress/hooks';
import { useDispatch, useSelect } from '@wordpress/data';
import { __ } from '@wordpress/i18n';
import { createHigherOrderComponent } from '@wordpress/compose';
import {
	InspectorControls,
	store as blockEditorStore,
} from '@wordpress/block-editor';
import { createBlock } from '@wordpress/blocks';
import { PanelBody, Notice, Button, BaseControl } from '@wordpress/components';
import { isBlobURL } from '@wordpress/blob';
import { store as coreStore } from '@wordpress/core-data';

import { store as uploadStore } from '../uploadQueue/store';

const SUPPORTED_BLOCKS = ['core/image', 'core/audio', 'core/video'];

function useAttachment(id: number) {
	return useSelect(
		(select) => {
			const { getEntityRecord } = select(coreStore);
			return id ? getEntityRecord('postType', 'attachment', id) : null;
		},
		[id]
	);
}

function useIsUploadingById(id) {
	return useSelect((select) => select(uploadStore).isUploadingById(id), [id]);
}

function useIsUploadingByUrl(url) {
	return useSelect(
		(select) => {
			if (!url) {
				return false;
			}

			const isUploading = select(uploadStore).isUploadingByUrl(url);

			return isUploading || isBlobURL(url);
		},
		[url]
	);
}

function UploadIndicator({ attachment }) {
	const isUploadingById = useIsUploadingById(attachment.id);
	const isUploadingByUrl = useIsUploadingByUrl(attachment.url);
	const isUploading = isUploadingById || isUploadingByUrl;

	const isPosterUploading = useSelect(
		(select) => {
			const isUploadingByUrl = select(uploadStore).isUploadingByUrl(
				attachment.poster
			);

			return Boolean(
				isUploadingByUrl ||
					(attachment.poster && isBlobURL(attachment.poster))
			);
		},
		[attachment]
	);

	return (
		<Fragment>
			{isUploading && (
				<Notice isDismissible={false}>
					<p>{__('Upload in progress', 'media-experiments')}</p>
				</Notice>
			)}
			{isPosterUploading && (
				<Notice isDismissible={false}>
					<p>
						{__('Poster Upload in progress', 'media-experiments')}
					</p>
				</Notice>
			)}
		</Fragment>
	);
}

function MuteVideo({ attributes, setAttributes }) {
	const post = useAttachment(attributes.id);

	// const { replaceBlock } = useDispatch( blockEditorStore );
	//
	// const recoverBlock = ( { name, attributes, innerBlocks } ) =>
	// 	createBlock( name, attributes, innerBlocks );
	//
	// const attemptBlockRecovery = () => {
	// 	replaceBlock( clientId, recoverBlock( block ) );
	// };
	//
	// const onSuccess = () => {
	// 	replaceBlock
	// }

	const onChange = ([media]) => {
		setAttributes({
			id: media.id,
			src: media.src,
			poster: attributes.poster || media.image?.src,
		});
	};

	const onClick = () => {
		// TODO: Fetch file, add to upload queue with ask to mute video.
	};

	if (!post) {
		return null;
	}

	if (post.meta.mexp_is_muted) {
		return null;
	}

	// TODO: Check whether video actually has audio or not.

	console.log(post);

	return (
		<Button variant="primary" onClick={onClick}>
			{__('Remove audio channel', 'media-experiments')}
		</Button>
	);
}

function ImportMedia({ attributes, onChange }) {
	const url = attributes.url || attributes.src;

	const { addItemFromUrl } = useDispatch(uploadStore);
	const isUploading = useIsUploadingByUrl(url) || isBlobURL(url);

	console.log('isUploading', url, isUploading);

	if (attributes.id || !url) {
		return null;
	}

	const onClick = () => {
		addItemFromUrl({
			url,
			onChange: ([media]) => onChange(media),
		});
	};

	return (
		<BaseControl>
			<BaseControl.VisualLabel>
				{__('Import external media', 'media-experiments')}
			</BaseControl.VisualLabel>
			<p>
				{__(
					'This file is not hosted on your site. Do you want to import it to your media library? Note: requires CORS.',
					'media-experiments'
				)}
			</p>
			<Button variant="primary" onClick={onClick} disabled={isUploading}>
				{__('Import', 'media-experiments')}
			</Button>
		</BaseControl>
	);
}

function VideoControls(props) {
	function onChange(media) {
		if (!media || !media.url) {
			return;
		}

		props.setAttributes({
			src: media.url,
			id: media.id,
			poster:
				media.image?.src !== media.icon ? media.image?.src : undefined,
			caption: media.caption,
		});
	}

	return (
		<Fragment>
			<ImportMedia {...props} onChange={onChange} />
			<MuteVideo {...props} />
		</Fragment>
	);
}

function BlockControls({ blockType, ...rest }) {
	switch (blockType) {
		case 'core/video':
			return (
				<>
					<VideoControls {...rest} />
				</>
			);
		case 'core/image':
			return null;

		case 'core/audio':
			return null;

		default:
			return null;
	}
}

function MediaPanel({ name, clientId, attributes, setAttributes }) {
	const attachment = {
		id: attributes.id,
		url: attributes.src || attributes.url,
		poster: attributes.poster,
	};

	return (
		<Fragment>
			<UploadIndicator attachment={attachment} />
			<BlockControls
				blockType={name}
				clientId={clientId}
				attributes={attributes}
				setAttributes={setAttributes}
			/>
		</Fragment>
	);
}

const addMediaPanel = createHigherOrderComponent(
	(BlockEdit) => (props) => {
		if (!SUPPORTED_BLOCKS.includes(props.name)) {
			return <BlockEdit {...props} />;
		}

		return (
			<Fragment>
				<BlockEdit {...props} />
				<InspectorControls>
					<PanelBody
						initialOpen={true}
						icon="admin-media"
						title={__('Media Experiments', 'media-experiments')}
					>
						<MediaPanel
							name={props.name}
							clientId={props.clientId}
							attributes={props.attributes}
							setAttributes={props.setAttributes}
						/>
					</PanelBody>
				</InspectorControls>
			</Fragment>
		);
	},
	'withMediaPanel'
);

addFilter(
	'editor.BlockEdit',
	'media-experiments/add-media-panel',
	addMediaPanel
);
