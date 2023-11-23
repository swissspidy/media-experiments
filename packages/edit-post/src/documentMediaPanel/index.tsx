import { registerPlugin } from '@wordpress/plugins';
import { PluginDocumentSettingPanel } from '@wordpress/edit-post';
import { __ } from '@wordpress/i18n';
import { useSelect } from '@wordpress/data';
import { store as coreStore } from '@wordpress/core-data';
import { store as blockEditorStore } from '@wordpress/block-editor';
import { type BlockInstance } from '@wordpress/blocks';
import { filterURLForDisplay } from '@wordpress/url';
import {
	PanelRow,
	// eslint-disable-next-line @wordpress/no-unsafe-wp-apis -- Psst.
	__experimentalText as Text,
	Button,
} from '@wordpress/components';

import { type Attachment, type RestAttachment } from '@mexp/upload-media';

import './styles.css';
import { ReactComponent as CompressIcon } from './icons/compress.svg';

const SUPPORTED_BLOCKS = [ 'core/image', 'core/video' ];

type ImageBlock = BlockInstance< {
	id: number;
	url: string;
} > & { name: 'core/image' };

type VideoBlock = BlockInstance< {
	id: number;
	src: string;
	poster: string;
	muted: boolean;
} > & { name: 'core/video' };

type AttachmentData = Pick< Attachment, 'id' | 'url' | 'fileSize' > & {
	posterUrl: Attachment[ 'url' ];
	clientId: BlockInstance[ 'clientId' ];
	blockName: BlockInstance[ 'name' ];
};

function isSupportedBlock(
	block: BlockInstance | null
): block is VideoBlock | ImageBlock {
	return block !== null && SUPPORTED_BLOCKS.includes( block.name );
}

function useMediaBlockAttachments() {
	// TODO: Allow optimizing video posters themselves.
	// Need to get the poster ID from REST API via something like attachment_url_to_postid().
	// TODO: Refactor to be less ugly and more performant.
	return useSelect(
		( select ) =>
			select( blockEditorStore )
				.getClientIdsWithDescendants()
				.map( ( clientId ) =>
					select( blockEditorStore ).getBlock( clientId )
				)
				.filter( isSupportedBlock )
				// TODO: Also include external images that would simply be imported & then optimized.
				.filter( ( block ) => block.attributes.id )
				.reduce(
					( acc, block ) => {
						if (
							! acc.find(
								( b ) => b.attributes.id === block.attributes.id
							)
						) {
							acc.push( block );
						}
						return acc;
					},
					[] as Array< VideoBlock | ImageBlock >
				)
				.map( ( block: ImageBlock | VideoBlock ) => {
					const attachment: AttachmentData = {
						clientId: block.clientId,
						blockName: block.name,
						id: block.attributes.id,
						url:
							'url' in block.attributes
								? block.attributes.url
								: block.attributes.src,
						posterUrl:
							'url' in block.attributes
								? block.attributes.url
								: block.attributes.poster ||
								  block.attributes.src,
						fileSize: 0,
					};

					// @ts-ignore -- TODO: Fix this without casting.
					const media: RestAttachment | undefined = select(
						coreStore
					).getMedia( block.attributes.id, {
						context: 'edit',
					} );

					// TODO: Use fetchRemoteFile() as fallback.
					if ( media && media.mexp_filesize ) {
						attachment.fileSize = media.mexp_filesize;
					}

					return attachment;
				} ),
		[]
	);
}

const numberFormatter = Intl.NumberFormat( 'en', {
	notation: 'compact',
	style: 'unit',
	unit: 'byte',
	unitDisplay: 'narrow',
	roundingPriority: 'lessPrecision',
	maximumSignificantDigits: 2,
	maximumFractionDigits: 2,
} );

function Row( props: AttachmentData ) {
	const onClick = () => {
		// eslint-disable-next-line no-console -- WIP.
		console.log( 'Compress single', props );
	};

	return (
		<PanelRow>
			<img src={ props.posterUrl } width={ 32 } height={ 32 } alt="" />
			<Text aria-label={ props.url }>
				{ filterURLForDisplay( props.url, 15 ) }
			</Text>
			<Text variant="muted">
				{ props.fileSize
					? numberFormatter.format( props.fileSize )
					: '? KB' }
			</Text>
			<Button
				icon={ <CompressIcon width={ 32 } height={ 32 } /> }
				className="mexp-document-panel-row__button"
				label={ __( 'Compress', 'media-experiments' ) }
				onClick={ onClick }
			></Button>
		</PanelRow>
	);
}

function CompressAll( props: { attachments: AttachmentData[] } ) {
	const onClick = () => {
		// Do the magic.
		for ( const attachment of props.attachments ) {
			// Add each one individually, but with the same batchId.
			// eslint-disable-next-line no-console -- WIP.
			console.log( 'Compress all', attachment );
		}
	};

	return (
		<Button variant="primary" onClick={ onClick }>
			{ __( 'Compress all', 'media-experiments' ) }
		</Button>
	);
}

function DocumentMediaPanel() {
	// TODO: Do not render anything if there are no media items to optimize.

	const attachments = useMediaBlockAttachments();

	return (
		<PluginDocumentSettingPanel
			name="media-experiments-document-panel"
			icon="admin-media"
			title={ __( 'Media Experiments', 'media-experiments' ) }
		>
			{ attachments.map( ( data ) => (
				<Row key={ data.id } { ...data } />
			) ) }
			{ attachments.length > 0 ? (
				<PanelRow>
					<CompressAll attachments={ attachments } />
				</PanelRow>
			) : null }
		</PluginDocumentSettingPanel>
	);
}

registerPlugin( 'media-experiments-document-panel', {
	render: DocumentMediaPanel,
} );
