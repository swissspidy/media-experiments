import { Blurhash } from 'react-blurhash';
import { Fragment, useState, useEffect } from '@wordpress/element';
import { addFilter } from '@wordpress/hooks';
import { useDispatch, useSelect } from '@wordpress/data';
import { __ } from '@wordpress/i18n';
import { createHigherOrderComponent } from '@wordpress/compose';
import { InspectorControls } from '@wordpress/block-editor';
import {
	PanelBody,
	Notice,
	Button,
	BaseControl,
	useBaseControlProps,
	ColorIndicator,
} from '@wordpress/components';
import { isBlobURL } from '@wordpress/blob';
import { store as coreStore } from '@wordpress/core-data';
import { store as editorStore } from '@wordpress/editor';

import { store as uploadStore } from '../uploadQueue/store';
import type { RestAttachment } from '../uploadQueue/store/types';

const SUPPORTED_BLOCKS = ['core/image', 'core/audio', 'core/video'];

function useAttachment(id: number): RestAttachment | null {
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

	const url = attributes.src;
	const isUploading = useIsUploadingByUrl(url) || isBlobURL(url);

	const { muteExistingVideo } = useDispatch(uploadStore);
	const currentPostId = useSelect(
		(select) => select(editorStore).getCurrentPostId(),
		[]
	);

	const onClick = () => {
		console.log('onClick', muteExistingVideo);
		muteExistingVideo({
			id: attributes.id,
			url: attributes.src,
			poster: attributes.poster,
			onChange: ([media]) =>
				setAttributes({
					src: media.url,
				}),
			onSuccess: ([media]) =>
				setAttributes({
					id: media.id,
					muted: true,
				}),
			blurHash: post.meta.mexp_blurhash,
			dominantColor: post.meta.mexp_dominant_color,
			generatedPosterId: post.meta.mexp_generated_poster_id,
			additionalData: {
				post: currentPostId,
			},
		});
	};

	if (!post || post.meta.mexp_is_muted) {
		return null;
	}

	return (
		<Button variant="primary" onClick={onClick} disabled={isUploading}>
			{__('Remove audio channel', 'media-experiments')}
		</Button>
	);
}

function ImportMedia({ attributes, onChange }) {
	const { baseControlProps, controlProps } = useBaseControlProps({});

	// Video and image blocks use different attribute names for the URL.
	const url = attributes.url || attributes.src;

	const { addItemFromUrl } = useDispatch(uploadStore);
	const isUploading = useIsUploadingByUrl(url);
	const currentPostId = useSelect(
		(select) => select(editorStore).getCurrentPostId(),
		[]
	);

	if (attributes.id || !url || isBlobURL(url)) {
		return null;
	}

	const onClick = () => {
		addItemFromUrl({
			url,
			onChange: ([media]) => onChange(media),
			additionalData: {
				post: currentPostId,
			},
		});
	};

	return (
		<BaseControl {...baseControlProps}>
			<BaseControl.VisualLabel>
				{__('Import external media', 'media-experiments')}
			</BaseControl.VisualLabel>
			<p>
				{__(
					'This file is not hosted on your site. Do you want to import it to your media library? Note: requires CORS.',
					'media-experiments'
				)}
			</p>
			<Button
				variant="primary"
				onClick={onClick}
				disabled={isUploading}
				{...controlProps}
			>
				{__('Import', 'media-experiments')}
			</Button>
		</BaseControl>
	);
}

function RestorePoster({ attributes, setAttributes }) {
	const { baseControlProps, controlProps } = useBaseControlProps({});

	const [posterId, setPosterId] = useState(null);

	const attachment = useAttachment(attributes.id);
	const poster = useAttachment(posterId);

	useEffect(() => {
		if (!attachment) {
			return;
		}
		setPosterId(
			attachment.featured_media ||
				attachment.meta.mexp_generated_poster_id
		);
	}, [attachment]);

	const url = attributes.src;
	const isUploading = useIsUploadingByUrl(url) || isBlobURL(url);

	if (attributes.poster || isUploading || !poster) {
		return null;
	}

	const onClick = () => {
		setAttributes({
			poster: poster.source_url,
		});
	};

	return (
		<BaseControl {...baseControlProps}>
			<BaseControl.VisualLabel>
				{__('Missing poster', 'media-experiments')}
			</BaseControl.VisualLabel>
			<p>
				{__(
					'Adding a poster image to videos is recommended, but your video is currently lacking one. However, you can restore the default auto-generated poster.',
					'media-experiments'
				)}
			</p>
			<Button variant="primary" onClick={onClick} {...controlProps}>
				{__('Restore Poster', 'media-experiments')}
			</Button>
		</BaseControl>
	);
}

function ShowBlurHash({ attributes }) {
	const { baseControlProps, controlProps } = useBaseControlProps({});

	const attachment = useAttachment(attributes.id);

	if (!attachment || !attachment.meta.mexp_blurhash) {
		return null;
	}

	const aspectRatio =
		((attachment.media_details.width as number) ?? 1) /
		((attachment.media_details.height as number) ?? 1);

	return (
		<BaseControl {...baseControlProps}>
			<BaseControl.VisualLabel>
				{__('BlurHash', 'media-experiments')}
			</BaseControl.VisualLabel>
			<div {...controlProps}>
				<Blurhash
					hash={attachment.meta.mexp_blurhash}
					width={200}
					height={200 / aspectRatio}
				/>
			</div>
		</BaseControl>
	);
}

function ShowDominantColor({ attributes }) {
	const { baseControlProps, controlProps } = useBaseControlProps({});

	const attachment = useAttachment(attributes.id);

	if (!attachment || !attachment.meta.mexp_dominant_color) {
		return null;
	}

	return (
		<BaseControl {...baseControlProps}>
			<BaseControl.VisualLabel>
				{__('Dominant color', 'media-experiments')}
			</BaseControl.VisualLabel>
			<div {...controlProps}>
				<ColorIndicator
					colorValue={attachment.meta.mexp_dominant_color}
				/>
			</div>
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
			<RestorePoster {...props} />
			<ShowBlurHash {...props} />
			<ShowDominantColor {...props} />
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
