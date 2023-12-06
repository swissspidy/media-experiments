import { Fragment } from '@wordpress/element';
import { addFilter } from '@wordpress/hooks';
import { __ } from '@wordpress/i18n';
import { createHigherOrderComponent } from '@wordpress/compose';
import type { BlockEditProps } from '@wordpress/blocks';
import { InspectorControls } from '@wordpress/block-editor';
import { PanelBody } from '@wordpress/components';
import { VideoControls } from './videoControls';
import { ImageControls } from './imageControls';
import { AudioControls } from './audioControls';
import { CoverControls } from './coverControls';

import { GalleryControls } from './galleryControls';
import { MediaTextControls } from './mediaTextControls';
import { PostFeaturedImageControls } from './postFeaturedImageControls';
import { SiteLogoControls } from './siteLogoControls';
import type {
	AudioBlock,
	CoverBlock,
	GalleryBlock,
	ImageBlock,
	MediaTextBlock,
	PostFeaturedImageBlock,
	SiteLogoBlock,
	VideoBlock,
} from './types';

import './styles.css';

const SUPPORTED_BLOCKS = [
	'core/image',
	'core/audio',
	'core/video',
	'core/media-text',
	'core/gallery',
	'core/cover',
	'core/post-featured-image',
	'core/site-logo',
];

type PerBlockControlsProps = MediaPanelProps;

function PerBlockControls( props: PerBlockControlsProps ) {
	switch ( props.name ) {
		case 'core/video':
			return (
				<>
					<VideoControls { ...props } />
				</>
			);
		case 'core/image':
			return (
				<>
					<ImageControls { ...props } />
				</>
			);

		case 'core/audio':
			return (
				<>
					<AudioControls { ...props } />
				</>
			);

		case 'core/media-text':
			return (
				<>
					<MediaTextControls { ...props } />
				</>
			);

		case 'core/gallery':
			return (
				<>
					<GalleryControls { ...props } />
				</>
			);

		case 'core/cover':
			return (
				<>
					<CoverControls { ...props } />
				</>
			);

		case 'core/post-featured-image':
			return (
				<>
					<PostFeaturedImageControls />
				</>
			);

		case 'core/site-logo':
			return (
				<>
					<SiteLogoControls { ...props } />
				</>
			);

		default:
			return null;
	}
}

type MediaPanelProps =
	| ( ImageBlock &
			Pick<
				BlockEditProps< ImageBlock[ 'attributes' ] >,
				'setAttributes'
			> )
	| ( VideoBlock &
			Pick<
				BlockEditProps< VideoBlock[ 'attributes' ] >,
				'setAttributes'
			> )
	| ( AudioBlock &
			Pick<
				BlockEditProps< AudioBlock[ 'attributes' ] >,
				'setAttributes'
			> )
	| ( GalleryBlock &
			Pick<
				BlockEditProps< GalleryBlock[ 'attributes' ] >,
				'setAttributes'
			> )
	| ( MediaTextBlock &
			Pick<
				BlockEditProps< MediaTextBlock[ 'attributes' ] >,
				'setAttributes'
			> )
	| ( CoverBlock &
			Pick<
				BlockEditProps< CoverBlock[ 'attributes' ] >,
				'setAttributes'
			> )
	| ( PostFeaturedImageBlock &
			Pick<
				BlockEditProps< PostFeaturedImageBlock[ 'attributes' ] >,
				'setAttributes'
			> )
	| ( SiteLogoBlock &
			Pick<
				BlockEditProps< SiteLogoBlock[ 'attributes' ] >,
				'setAttributes'
			> );

const addMediaPanel = createHigherOrderComponent(
	( BlockEdit ) => ( props ) => {
		if ( ! SUPPORTED_BLOCKS.includes( props.name ) ) {
			return <BlockEdit { ...props } />;
		}

		return (
			<Fragment>
				<BlockEdit { ...props } />
				<InspectorControls>
					<PanelBody
						initialOpen={ true }
						icon="admin-media"
						title={ __( 'Media Experiments', 'media-experiments' ) }
					>
						<PerBlockControls { ...props } />
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
