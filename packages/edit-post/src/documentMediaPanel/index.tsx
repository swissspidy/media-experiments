import { v4 as uuidv4 } from 'uuid';

import { registerPlugin } from '@wordpress/plugins';
import { PluginDocumentSettingPanel } from '@wordpress/edit-post';
import { __, sprintf } from '@wordpress/i18n';
import { useDispatch, useSelect } from '@wordpress/data';
import { store as coreStore } from '@wordpress/core-data';
import { store as blockEditorStore } from '@wordpress/block-editor';
import { type BlockInstance } from '@wordpress/blocks';
import { filterURLForDisplay } from '@wordpress/url';
import { store as noticesStore } from '@wordpress/notices';
import { Fragment } from '@wordpress/element';
import {
	PanelRow,
	// eslint-disable-next-line @wordpress/no-unsafe-wp-apis -- Psst.
	__experimentalText as Text,
	Button,
	Tooltip,
} from '@wordpress/components';

import {
	store as uploadStore,
	type Attachment,
	type RestAttachment,
} from '@mexp/upload-media';

import './styles.css';
import { ReactComponent as CompressIcon } from './icons/compress.svg';
import { store as editorStore } from '@wordpress/editor';
import { ApprovalDialog } from '../components/approvalDialog';

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
	isUploading: boolean;
	isOptimized: boolean;
	isFetched: boolean;
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
						isUploading: select( uploadStore ).isUploadingById(
							block.attributes.id
						),
						isOptimized: false,
						isFetched: false,
					};

					// @ts-ignore -- TODO: Fix this without casting.
					const media: RestAttachment | undefined = select(
						coreStore
					).getMedia( block.attributes.id, {
						context: 'edit',
					} );

					if ( media ) {
						attachment.isFetched = true;

						attachment.isOptimized =
							media.mexp_media_source.length > 0;

						// TODO: Use fetchRemoteFile() as fallback.
						if ( media.mexp_filesize ) {
							attachment.fileSize = media.mexp_filesize;
						}
					}

					return attachment;
				} )
				.filter( ( data ) => data.isFetched && ! data.isOptimized ),
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
	const { optimizeExistingItem } = useDispatch( uploadStore );
	const { createSuccessNotice, createErrorNotice } =
		useDispatch( noticesStore );
	const { updateBlockAttributes } = useDispatch( blockEditorStore );
	const currentPostId = useSelect(
		( select ) => select( editorStore ).getCurrentPostId(),
		[]
	);

	const onClick = () => {
		void optimizeExistingItem( {
			id: props.id,
			url: props.url,
			onSuccess: ( [ media ] ) => {
				void updateBlockAttributes( props.clientId, {
					id: media.id,
					url: media.url,
				} );
				void createSuccessNotice(
					__( 'File successfully optimized.', 'media-experiments' ),
					{
						type: 'snackbar',
					}
				);
			},
			onError: ( err: Error ) => {
				void createErrorNotice(
					sprintf(
						/* translators: %s: error message */
						__(
							'There was an error optimizing the file: %s',
							'media-experiments'
						),
						err.message
					),
					{
						type: 'snackbar',
					}
				);
			},
			additionalData: {
				post: currentPostId,
			},
		} );
	};

	return (
		<PanelRow>
			<img src={ props.posterUrl } width={ 32 } height={ 32 } alt="" />
			<Tooltip text={ props.url }>
				<Text aria-label={ props.url }>
					{ filterURLForDisplay( props.url, 15 ) }
				</Text>
			</Tooltip>
			<Text variant="muted">
				{ props.fileSize
					? numberFormatter.format( props.fileSize )
					: /* translators: unknown file size */
					  __( '? KB', 'media-experiments' ) }
			</Text>
			<Button
				icon={ <CompressIcon width={ 32 } height={ 32 } /> }
				className="mexp-document-panel-row__button"
				label={ __( 'Optimize', 'media-experiments' ) }
				onClick={ onClick }
				disabled={ props.isUploading }
			></Button>
		</PanelRow>
	);
}

function CompressAll( props: { attachments: AttachmentData[] } ) {
	const currentPostId = useSelect(
		( select ) => select( editorStore ).getCurrentPostId(),
		[]
	);

	const { updateBlockAttributes } = useDispatch( blockEditorStore );
	const { createSuccessNotice, createErrorNotice } =
		useDispatch( noticesStore );
	const { optimizeExistingItem } = useDispatch( uploadStore );

	const onClick = () => {
		const batchId = uuidv4();

		for ( const attachment of props.attachments ) {
			if ( attachment.isUploading ) {
				continue;
			}

			void optimizeExistingItem( {
				batchId,
				id: attachment.id,
				url: attachment.url,
				onSuccess: ( [ media ] ) => {
					void updateBlockAttributes( attachment.clientId, {
						id: media.id,
						url: media.url,
					} );
				},
				onError: ( err: Error ) => {
					void createErrorNotice(
						sprintf(
							/* translators: %s: error message */
							__(
								'There was an error optimizing the file: %s',
								'media-experiments'
							),
							err.message
						),
						{
							type: 'snackbar',
						}
					);
				},
				onBatchSuccess: () => {
					void createSuccessNotice(
						__(
							'All files successfully optimized.',
							'media-experiments'
						),
						{
							type: 'snackbar',
						}
					);
				},
				additionalData: {
					post: currentPostId,
				},
			} );
		}
	};

	const areAllUploading = props.attachments.every(
		( { isUploading } ) => isUploading
	);

	return (
		<Button
			variant="primary"
			onClick={ onClick }
			disabled={ areAllUploading }
		>
			{ __( 'Optimize all', 'media-experiments' ) }
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
				<Fragment key={ data.id }>
					<Row { ...data } />
					<ApprovalDialog id={ data.id } />
				</Fragment>
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
