/**
 * WordPress dependencies
 */
import { addFilter } from '@wordpress/hooks';
import { __ } from '@wordpress/i18n';
import { createHigherOrderComponent } from '@wordpress/compose';
import { InspectorControls } from '@wordpress/block-editor';
import { PanelBody } from '@wordpress/components';
import { media } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import { VideoControls } from './video-controls';
import { ImageControls } from './image-controls';
import { AudioControls } from './audio-controls';
import { CoverControls } from './cover-controls';
import { FileControls } from './file-controls';

import { GalleryControls } from './gallery-controls';
import { MediaTextControls } from './media-text-controls';
import { PostFeaturedImageControls } from './post-featured-image-controls';
import { SiteLogoControls } from './site-logo-controls';
import type { MediaPanelProps } from '../types';

const SUPPORTED_BLOCKS = [
	'core/image',
	'core/audio',
	'core/video',
	'core/media-text',
	'core/gallery',
	'core/cover',
	'core/post-featured-image',
	'core/site-logo',
	'core/file',
];

type PerBlockControlsProps = MediaPanelProps;

function PerBlockControls( props: PerBlockControlsProps ) {
	switch ( props.name ) {
		case 'core/video':
			return <VideoControls { ...props } />;
		case 'core/image':
			return <ImageControls { ...props } />;

		case 'core/audio':
			return <AudioControls { ...props } />;

		case 'core/media-text':
			return <MediaTextControls { ...props } />;

		case 'core/gallery':
			return <GalleryControls { ...props } />;

		case 'core/cover':
			return <CoverControls { ...props } />;

		case 'core/post-featured-image':
			return <PostFeaturedImageControls { ...props } />;

		case 'core/site-logo':
			return <SiteLogoControls { ...props } />;

		case 'core/file':
			return <FileControls { ...props } />;

		default:
			return null;
	}
}

const addMediaPanel = createHigherOrderComponent(
	( BlockEdit ) => ( props: PerBlockControlsProps ) => {
		if ( ! SUPPORTED_BLOCKS.includes( props.name ) ) {
			return <BlockEdit { ...props } />;
		}

		return (
			<>
				<BlockEdit { ...props } />
				<InspectorControls>
					<PanelBody
						initialOpen={ true }
						icon={ media }
						title={ __( 'Media Experiments', 'media-experiments' ) }
					>
						<PerBlockControls { ...props } />
					</PanelBody>
				</InspectorControls>
			</>
		);
	},
	'withMediaPanel'
);

addFilter(
	'editor.BlockEdit',
	'media-experiments/add-media-panel',
	addMediaPanel
);
