/**
 * WordPress dependencies
 */
import { addFilter } from '@wordpress/hooks';
import { __ } from '@wordpress/i18n';
import { createHigherOrderComponent } from '@wordpress/compose';
import {
	InspectorControls,
	store as blockEditorStore,
} from '@wordpress/block-editor';
import { PanelBody } from '@wordpress/components';
import { media } from '@wordpress/icons';
import { useSelect } from '@wordpress/data';

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
import { BulkOptimization } from '../components/bulk-optimization';
import { useBlockAttachments } from '../utils/hooks';
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

// Blocks that can have image attachments for bulk optimization
const IMAGE_BLOCKS = [
	'core/image',
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

function MultiSelectionControls( {
	selectedClientIds,
}: {
	selectedClientIds: string[];
} ) {
	const { selectedBlockNames } = useSelect(
		( select ) => {
			const { getBlockName } = select( blockEditorStore );

			return {
				selectedBlockNames: selectedClientIds
					.map( ( clientId ) => getBlockName( clientId ) )
					.filter( ( name ): name is string => name !== null ),
			};
		},
		[ selectedClientIds ]
	);

	// Always call hooks unconditionally
	const attachments = useBlockAttachments( selectedClientIds );

	// Check if we have multiple blocks selected
	if ( selectedClientIds.length <= 1 ) {
		return null;
	}

	// Check if all selected blocks are image blocks
	const allImageBlocks = selectedBlockNames.every( ( name ) =>
		IMAGE_BLOCKS.includes( name )
	);

	if ( ! allImageBlocks ) {
		return null;
	}

	if ( ! attachments.length ) {
		return null;
	}

	return <BulkOptimization attachments={ attachments } />;
}

const addMediaPanel = createHigherOrderComponent(
	( BlockEdit ) => ( props: PerBlockControlsProps ) => {
		const { selectedClientIds } = useSelect(
			( select ) => ( {
				selectedClientIds:
					select( blockEditorStore ).getSelectedBlockClientIds(),
			} ),
			[]
		);

		// If multiple blocks are selected, show multi-selection controls
		if ( selectedClientIds.length > 1 ) {
			return (
				<>
					<BlockEdit { ...props } />
					<InspectorControls>
						<PanelBody
							initialOpen={ true }
							icon={ media }
							title={ __(
								'Media Experiments',
								'media-experiments'
							) }
						>
							<MultiSelectionControls
								selectedClientIds={ selectedClientIds }
							/>
						</PanelBody>
					</InspectorControls>
				</>
			);
		}

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
