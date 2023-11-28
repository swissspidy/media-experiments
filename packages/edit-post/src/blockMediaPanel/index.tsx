import { Blurhash } from 'react-blurhash';

import {
	Fragment,
	useState,
	useEffect,
	createInterpolateElement,
} from '@wordpress/element';
import { addFilter } from '@wordpress/hooks';
import { useDispatch, useSelect } from '@wordpress/data';
import { __, sprintf } from '@wordpress/i18n';
import { createHigherOrderComponent } from '@wordpress/compose';
import type { BlockEditProps, BlockInstance } from '@wordpress/blocks';
import { InspectorControls } from '@wordpress/block-editor';
import {
	PanelBody,
	Notice,
	Button,
	BaseControl,
	useBaseControlProps,
	ColorIndicator,
	PanelRow,
} from '@wordpress/components';
import { isBlobURL } from '@wordpress/blob';
import { store as editorStore } from '@wordpress/editor';
import { store as noticesStore } from '@wordpress/notices';

import { store as uploadStore, type Attachment } from '@mexp/upload-media';

import { store as recordingStore } from '../mediaRecording/store';
import { useAttachment, useIsUploadingById } from '../utils/hooks';

import './styles.css';
import { ApprovalDialog } from '../components/approvalDialog';

const SUPPORTED_BLOCKS = [ 'core/image', 'core/audio', 'core/video' ];

function useIsUploadingByUrl( url?: string ) {
	return useSelect(
		( select ) => {
			if ( ! url ) {
				return false;
			}

			const isUploading = select( uploadStore ).isUploadingByUrl( url );

			return isUploading || isBlobURL( url );
		},
		[ url ]
	);
}

interface UploadIndicatorProps {
	attachment: Partial< Attachment >;
}

function UploadIndicator( { attachment }: UploadIndicatorProps ) {
	const isUploadingById = useIsUploadingById( attachment.id );
	const isUploadingByUrl = useIsUploadingByUrl( attachment.url );
	const isPosterUploadingByUrl = useIsUploadingByUrl( attachment.poster );
	const isUploading = isUploadingById || isUploadingByUrl;

	const isPosterUploading = Boolean(
		isPosterUploadingByUrl ||
			( attachment.poster && isBlobURL( attachment.poster ) )
	);

	return (
		<Fragment>
			{ isUploading && (
				<Notice isDismissible={ false }>
					<p>{ __( 'Upload in progress', 'media-experiments' ) }</p>
				</Notice>
			) }
			{ isPosterUploading && (
				<Notice isDismissible={ false }>
					<p>
						{ __(
							'Poster Upload in progress',
							'media-experiments'
						) }
					</p>
				</Notice>
			) }
		</Fragment>
	);
}

interface MuteVideoProps {
	attributes: {
		id?: number;
		src: string;
		poster: string;
	};
	setAttributes: ( attributes: Record< string, unknown > ) => void;
}

function MuteVideo( { attributes, setAttributes }: MuteVideoProps ) {
	const post = useAttachment( attributes.id );

	const url = attributes.src;
	const isUploading = useIsUploadingByUrl( url ) || isBlobURL( url );

	const { muteExistingVideo } = useDispatch( uploadStore );
	const currentPostId = useSelect(
		( select ) => select( editorStore ).getCurrentPostId(),
		[]
	);

	if ( ! post || post.meta.mexp_is_muted ) {
		return null;
	}

	const onClick = () => {
		// TODO: Figure out why poster is not
		void muteExistingVideo( {
			id: post.id,
			url: attributes.src,
			poster: attributes.poster,
			onChange: ( [ media ] ) =>
				setAttributes( {
					src: media.url,
				} ),
			onSuccess: ( [ media ] ) =>
				setAttributes( {
					id: media.id,
					muted: true,
				} ),
			blurHash: post?.meta.mexp_blurhash,
			dominantColor: post?.meta.mexp_dominant_color,
			generatedPosterId: post?.meta.mexp_generated_poster_id,
			additionalData: {
				post: currentPostId,
			},
		} );
	};

	return (
		<Button variant="primary" onClick={ onClick } disabled={ isUploading }>
			{ __( 'Remove audio channel', 'media-experiments' ) }
		</Button>
	);
}

type RecordingControlsProps = MediaPanelProps;

function RecordingControls( { attributes, clientId }: RecordingControlsProps ) {
	const { baseControlProps, controlProps } = useBaseControlProps( {} );

	const url = 'url' in attributes ? attributes.url : attributes.src;

	const { enterRecordingMode, leaveRecordingMode } =
		useDispatch( recordingStore );

	const isInRecordingMode = useSelect(
		( select ) => select( recordingStore ).isInRecordingMode(),
		[]
	);

	if ( url ) {
		return null;
	}

	const onClick = () => {
		if ( isInRecordingMode ) {
			void leaveRecordingMode();
		} else {
			void enterRecordingMode( clientId );
		}
	};

	return (
		<BaseControl { ...baseControlProps }>
			<BaseControl.VisualLabel>
				{ __( 'Self Recording', 'media-experiments' ) }
			</BaseControl.VisualLabel>
			<p>
				{ __(
					"Use your device's camera and microphone to record video, audio, or take a still picture",
					'media-experiments'
				) }
			</p>
			<Button variant="primary" onClick={ onClick } { ...controlProps }>
				{ isInRecordingMode
					? __( 'Exit', 'media-experiments' )
					: __( 'Start', 'media-experiments' ) }
			</Button>
		</BaseControl>
	);
}

type ImportMediaProps = {
	onChange: ( attachment: Partial< Attachment > ) => void;
} & MediaPanelProps;

function ImportMedia( { attributes, onChange }: ImportMediaProps ) {
	const { baseControlProps, controlProps } = useBaseControlProps( {} );

	const url = 'url' in attributes ? attributes.url : attributes.src;

	const { addItemFromUrl } = useDispatch( uploadStore );
	const isUploading = useIsUploadingByUrl( url );
	const currentPostId = useSelect(
		( select ) => select( editorStore ).getCurrentPostId(),
		[]
	);

	if ( attributes.id || ! url || isBlobURL( url ) ) {
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

interface OptimizeMediaProps {
	name: string;
	attributes: {
		id?: number;
		poster?: string;
		src?: string;
		url?: string;
	};
	setAttributes: ( attributes: Record< string, unknown > ) => void;
}

function OptimizeMedia( {
	name,
	attributes,
	setAttributes,
}: OptimizeMediaProps ) {
	const { baseControlProps, controlProps } = useBaseControlProps( {} );

	const post = useAttachment( attributes.id );
	const { optimizeExistingItem } = useDispatch( uploadStore );
	const isUploading = useIsUploadingById( attributes.id );
	const currentPostId = useSelect(
		( select ) => select( editorStore ).getCurrentPostId(),
		[]
	);
	const { createSuccessNotice, createErrorNotice } =
		useDispatch( noticesStore );

	const url = 'url' in attributes ? attributes.url : attributes.src;

	if (
		! post ||
		! url ||
		isBlobURL( url ) ||
		post.mexp_media_source.length > 0
	) {
		return null;
	}

	const onClick = () => {
		void optimizeExistingItem( {
			id: post.id,
			url: post.source_url || url,
			poster: attributes.poster,
			onSuccess: ( [ media ] ) => {
				if ( 'core/video' === name ) {
					setAttributes( {
						id: media.id,
						src: media.url,
					} );
				} else {
					setAttributes( {
						id: media.id,
						url: media.url,
					} );
				}
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
			blurHash: post.meta.mexp_blurhash,
			dominantColor: post.meta.mexp_dominant_color,
			generatedPosterId: post.meta.mexp_generated_poster_id,
			additionalData: {
				post: currentPostId,
			},
		} );
	};

	// TODO: This needs some (async) checks first to see whether optimization is needed.

	return (
		<>
			<BaseControl { ...baseControlProps }>
				<BaseControl.VisualLabel>
					{ __( 'Optimize media', 'media-experiments' ) }
				</BaseControl.VisualLabel>
				<p>
					{ __(
						'Maybe you can make the file a bit smaller?',
						'media-experiments'
					) }
				</p>
				<Button
					variant="primary"
					onClick={ onClick }
					disabled={ isUploading }
					{ ...controlProps }
				>
					{ __( 'Optimize', 'media-experiments' ) }
				</Button>
			</BaseControl>
			<ApprovalDialog id={ post.id } />
		</>
	);
}

interface RestorePosterProps {
	attributes: {
		id?: number;
		poster?: string;
		src: string;
	};
	setAttributes: ( attributes: Record< string, unknown > ) => void;
}

function RestorePoster( { attributes, setAttributes }: RestorePosterProps ) {
	const { baseControlProps, controlProps } = useBaseControlProps( {} );

	const [ posterId, setPosterId ] = useState< number | undefined >();

	const attachment = useAttachment( attributes.id );
	const poster = useAttachment( posterId );

	useEffect( () => {
		if ( ! attachment ) {
			return;
		}
		setPosterId(
			attachment.featured_media ||
				attachment.meta.mexp_generated_poster_id
		);
	}, [ attachment ] );

	const url = attributes.src;
	const isUploading = useIsUploadingByUrl( url ) || isBlobURL( url );

	if ( attributes.poster || isUploading || ! poster ) {
		return null;
	}

	const onClick = () => {
		setAttributes( {
			poster: poster.source_url,
		} );
	};

	return (
		<BaseControl { ...baseControlProps }>
			<BaseControl.VisualLabel>
				{ __( 'Missing poster', 'media-experiments' ) }
			</BaseControl.VisualLabel>
			<p>
				{ __(
					'Adding a poster image to videos is recommended, but your video is currently lacking one. However, you can restore the default auto-generated poster.',
					'media-experiments'
				) }
			</p>
			<Button variant="primary" onClick={ onClick } { ...controlProps }>
				{ __( 'Restore Poster', 'media-experiments' ) }
			</Button>
		</BaseControl>
	);
}

interface DebugInfoProps {
	attributes: {
		id?: number;
	};
}

const numberFormatter = Intl.NumberFormat( 'en', {
	notation: 'compact',
	style: 'unit',
	unit: 'byte',
	unitDisplay: 'narrow',
	// @ts-ignore -- TODO: Update types somehow.
	roundingPriority: 'lessPrecision',
	maximumSignificantDigits: 2,
	maximumFractionDigits: 2,
} );

function DebugInfo( { attributes }: DebugInfoProps ) {
	const { baseControlProps, controlProps } = useBaseControlProps( {} );

	const attachment = useAttachment( attributes.id );

	if ( ! attachment ) {
		return null;
	}

	const aspectRatio =
		( ( attachment.media_details.width as number ) ?? 1 ) /
		( ( attachment.media_details.height as number ) ?? 1 );

	return (
		<BaseControl { ...baseControlProps }>
			<BaseControl.VisualLabel>
				{ __( 'Debug Information', 'media-experiments' ) }
			</BaseControl.VisualLabel>
			<div { ...controlProps }>
				<PanelRow>
					{ createInterpolateElement(
						sprintf(
							/* translators: %s: File type. */
							__( '<b>Mime type:</b> %s', 'media-experiments' ),
							attachment.mime_type
						),
						{
							b: <b />,
						}
					) }
				</PanelRow>
				{ attachment.mexp_filesize ? (
					<PanelRow>
						{ createInterpolateElement(
							sprintf(
								/* translators: %s: File size. */
								__(
									'<b>File size:</b> %s',
									'media-experiments'
								),
								numberFormatter.format(
									attachment.mexp_filesize
								)
							),
							{
								b: <b />,
							}
						) }
					</PanelRow>
				) : null }
				<PanelRow>
					{ createInterpolateElement(
						sprintf(
							/* translators: %s: Color indicator. */
							__(
								'<b>Dominant color:</b> %s',
								'media-experiments'
							),
							'<ColorIndicator />'
						),
						{
							b: <b />,
							ColorIndicator: (
								<ColorIndicator
									colorValue={
										attachment.meta.mexp_dominant_color
									}
								/>
							),
						}
					) }
				</PanelRow>
				{ attachment.meta.mexp_blurhash ? (
					<PanelRow>
						{ createInterpolateElement(
							sprintf(
								/* translators: %s: BlurHash. */
								__(
									'<b>BlurHash:</b> %s',
									'media-experiments'
								),
								'<Blurhash />'
							),
							{
								b: <b />,
								Blurhash: (
									<Blurhash
										hash={ attachment.meta.mexp_blurhash }
										width={ 100 }
										height={ 100 / aspectRatio }
									/>
								),
							}
						) }
					</PanelRow>
				) : null }
			</div>
		</BaseControl>
	);
}

type VideoControlsProps = VideoBlock &
	Pick< BlockEditProps< VideoBlock[ 'attributes' ] >, 'setAttributes' >;

function VideoControls( props: VideoControlsProps ) {
	function onChange( media: Partial< Attachment > ) {
		if ( ! media || ! media.url ) {
			return;
		}

		props.setAttributes( {
			src: media.url,
			id: media.id,
			poster: media.image?.src,
			// TODO: What did I mean with `media.icon` here?
			// poster: media.image?.src !== media.icon ? media.image?.src : undefined,
			caption: media.caption,
		} );
	}

	return (
		<Fragment>
			<RecordingControls { ...props } />
			<ImportMedia { ...props } onChange={ onChange } />
			<MuteVideo { ...props } />
			<RestorePoster { ...props } />
			<DebugInfo { ...props } />
		</Fragment>
	);
}

type ImageControlsProps = ImageBlock &
	Pick< BlockEditProps< ImageBlock[ 'attributes' ] >, 'setAttributes' >;

function ImageControls( props: ImageControlsProps ) {
	function onChange( media: Partial< Attachment > ) {
		if ( ! media || ! media.url ) {
			return;
		}

		props.setAttributes( {
			url: media.url,
			id: media.id,
		} );
	}

	return (
		<Fragment>
			<RecordingControls { ...props } />
			<ImportMedia { ...props } onChange={ onChange } />
			<OptimizeMedia { ...props } />
			<DebugInfo { ...props } />
		</Fragment>
	);
}

type AudioControlsProps = AudioBlock &
	Pick< BlockEditProps< AudioBlock[ 'attributes' ] >, 'setAttributes' >;

function AudioControls( props: AudioControlsProps ) {
	function onChange( media: Partial< Attachment > ) {
		if ( ! media || ! media.url ) {
			return;
		}

		props.setAttributes( {
			url: media.url,
			id: media.id,
		} );
	}

	return (
		<Fragment>
			<RecordingControls { ...props } />
			<ImportMedia { ...props } onChange={ onChange } />
		</Fragment>
	);
}

type BlockControlsProps = MediaPanelProps;

function BlockControls( props: BlockControlsProps ) {
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

		default:
			return null;
	}
}

type ImageBlock = BlockInstance< {
	id: number;
	url: string;
} > & { name: 'core/image' };

type AudioBlock = BlockInstance< {
	id: number;
	url: string;
} > & { name: 'core/audio' };

type VideoBlock = BlockInstance< {
	id: number;
	src: string;
	poster: string;
	muted: boolean;
	caption: string;
} > & { name: 'core/video' };

type MediaPanelProps = ( ImageBlock | VideoBlock | AudioBlock ) &
	Pick< BlockEditProps< VideoBlock[ 'attributes' ] >, 'setAttributes' >;

function MediaPanel( props: MediaPanelProps ) {
	const { attributes } = props;

	const attachment: Partial< Attachment > = {
		id: attributes.id,
		url: 'url' in attributes ? attributes.url : attributes.src,
		poster: 'poster' in attributes ? attributes.poster : undefined,
	};

	return (
		<Fragment>
			<UploadIndicator attachment={ attachment } />
			<BlockControls { ...props } />
		</Fragment>
	);
}

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
						<MediaPanel { ...props } />
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
