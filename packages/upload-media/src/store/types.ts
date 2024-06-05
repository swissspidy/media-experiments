import type { WP_REST_API_Attachment, WP_REST_API_Term } from 'wp-types';

export type { WP_REST_API_Term };

export type QueueItemId = string;

export type QueueStatus = 'active' | 'paused';

export type BatchId = string;

// Keep in sync with PHP.
export type MediaSourceTerm =
	| 'media-optimization'
	| 'poster-generation'
	| 'media-import'
	| 'gif-conversion'
	| 'subtitles-generation';

export type QueueItem = {
	id: QueueItemId;
	sourceFile: File;
	file: File;
	poster?: File;
	attachment?: Partial< Attachment >;
	status: ItemStatus;
	additionalData: AdditionalData;
	onChange?: OnChangeHandler;
	onSuccess?: OnSuccessHandler;
	onError?: OnErrorHandler;
	onBatchSuccess?: OnBatchSuccessHandler;
	currentOperation?: OperationType;
	operations?: Operation[];
	error?: Error;
	batchId?: string;
	sourceUrl?: string;
	sourceAttachmentId?: number; // TODO: implement.
	mediaSourceTerms?: MediaSourceTerm[];
	blurHash?: string;
	dominantColor?: string;
	generatedPosterId?: number;
	parentId?: QueueItemId;
	abortController?: AbortController;
};

export interface State {
	queue: QueueItem[];
	mediaSourceTerms: Partial< Record< MediaSourceTerm, number > >;
	imageSizes: Record< string, ImageSizeCrop >;
	queueStatus: QueueStatus;
}

export enum Type {
	Unknown = 'REDUX_UNKNOWN',
	Add = 'ADD_ITEM',
	Prepare = 'PREPARE_ITEM',
	Cancel = 'CANCEL_ITEM',
	Remove = 'REMOVE_ITEM',
	PauseItem = 'PAUSE_ITEM',
	ResumeItem = 'RESUME_ITEM',
	PauseQueue = 'PAUSE_QUEUE',
	ResumeQueue = 'RESUME_QUEUE',
	SetMediaSourceTerms = 'ADD_MEDIA_SOURCE_TERMS',
	SetImageSizes = 'ADD_IMAGE_SIZES',
	RequestApproval = 'REQUEST_APPROVAL',
	ApproveUpload = 'APPROVE_UPLOAD',
	OperationStart = 'OPERATION_START',
	OperationFinish = 'OPERATION_FINISH',
	AddOperations = 'ADD_OPERATIONS',
}

type Action< T = Type, Payload = Record< string, unknown > > = {
	type: T;
} & Payload;

export type UnknownAction = Action< Type.Unknown >;
export type AddAction = Action<
	Type.Add,
	{
		item: Omit< QueueItem, 'operations' > &
			Partial< Pick< QueueItem, 'operations' > >;
	}
>;
export type OperationStartAction = Action<
	Type.OperationStart,
	{ id: QueueItemId }
>;
export type OperationFinishAction = Action<
	Type.OperationFinish,
	{
		id: QueueItemId;
		item: Partial< QueueItem >;
	}
>;
export type AddOperationsAction = Action<
	Type.AddOperations,
	{ id: QueueItemId; operations: Operation[] }
>;
export type RequestApprovalAction = Action<
	Type.RequestApproval,
	{ id: QueueItemId; file: File; url: string }
>;
export type ApproveUploadAction = Action<
	Type.ApproveUpload,
	{ id: QueueItemId }
>;
export type CancelAction = Action<
	Type.Cancel,
	{ id: QueueItemId; error: Error }
>;
export type PauseItemAction = Action< Type.PauseItem, { id: QueueItemId } >;
export type ResumeItemAction = Action< Type.ResumeItem, { id: QueueItemId } >;
export type PauseQueueAction = Action< Type.PauseQueue >;
export type ResumeQueueAction = Action< Type.ResumeQueue >;
export type RemoveAction = Action< Type.Remove, { id: QueueItemId } >;
export type SetMediaSourceTermsAction = Action<
	Type.SetMediaSourceTerms,
	{ terms: Record< MediaSourceTerm, number > }
>;
export type SetImageSizesAction = Action<
	Type.SetImageSizes,
	{ imageSizes: Record< string, ImageSizeCrop > }
>;

export type Attachment = {
	id: number;
	url: string;
	alt: string;
	caption?: string;
	title: string;
	mimeType: string;
	poster?: string;
	blurHash?: string;
	dominantColor?: string;
	posterId?: number;
	// Video block expects such a structure for the poster.
	// https://github.com/WordPress/gutenberg/blob/e0a413d213a2a829ece52c6728515b10b0154d8d/packages/block-library/src/video/edit.js#L154
	image?: {
		src: string;
	};
	missingImageSizes?: string[];
	fileName?: string;
	fileSize?: number;
};

export type OnChangeHandler = ( attachments: Partial< Attachment >[] ) => void;
export type OnSuccessHandler = ( attachments: Partial< Attachment >[] ) => void;
export type OnErrorHandler = ( error: Error ) => void;
export type OnBatchSuccessHandler = () => void;

export enum ItemStatus {
	Processing = 'PROCESSING',
	Paused = 'PAUSED',
	PendingApproval = 'PENDING_APPROVAL',
}

export enum OperationType {
	AddPoster = 'ADD_POSTER',
	UploadPoster = 'UPLOAD_POSTER',
	UploadOriginal = 'UPLOAD_ORIGINAL',
	ThumbnailGeneration = 'THUMBNAIL_GENERATION',
	TranscodeResizeCrop = 'RESIZE_CROP',
	TranscodeHeif = 'TRANSCODE_HEIF',
	TranscodeGif = 'TRANSCODE_GIF',
	TranscodeAudio = 'TRANSCODE_AUDIO',
	TranscodeVideo = 'TRANSCODE_VIDEO',
	TranscodeImage = 'TRANSCODE_IMAGE',
	TranscodeMuteVideo = 'TRANSCODE_MUTE_VIDEO',
	TranscodeCompress = 'TRANSCODE_COMPRESS',
	Upload = 'UPLOAD',
}

export type OperationArgs = {
	[ OperationType.TranscodeCompress ]: { requireApproval?: boolean };
	[ OperationType.TranscodeResizeCrop ]: { resize?: ImageSizeCrop };
};

type OperationWithArgs< T extends keyof OperationArgs = keyof OperationArgs > =
	[ T, OperationArgs[ T ] ];

export type Operation = OperationType | OperationWithArgs;

export interface RestAttachment extends WP_REST_API_Attachment {
	mexp_filename: string | null;
	mexp_filesize: number | null;
	mexp_media_source: number[];
	meta: {
		mexp_generated_poster_id?: number;
		mexp_original_id?: number;
		mexp_optimized_id?: number;
	};
	mexp_blurhash?: string;
	mexp_dominant_color?: string;
	mexp_is_muted?: boolean;
	mexp_has_transparency?: boolean;
}

export type CreateRestAttachment = Partial< RestAttachment > & {
	generate_sub_sizes?: boolean;
};

export type AdditionalData = Omit<
	CreateRestAttachment,
	'meta' | 'mexp_media_source'
> & {
	/**
	 * The ID for the associated post of the attachment.
	 *
	 * TODO: Figure out why it's not inherited from RestAttachment / WP_REST_API_Attachment type.
	 */
	post?: RestAttachment[ 'id' ];
};

export type CreateSideloadFile = {
	image_size?: string;
	upload_request?: string;
};

export type SideloadAdditionalData = {
	post: RestAttachment[ 'id' ];
	image_size?: string;
	upload_request?: string;
};

export type ImageSizeCrop = {
	name?: string; // Only set if dealing with sub-sizes, not for general cropping.
	width: number;
	height: number;
	crop?:
		| boolean
		| [ 'left' | 'center' | 'right', 'top' | 'center' | 'bottom' ];
};

export type ImageLibrary = 'browser' | 'vips';

export type ImageFormat = 'jpeg' | 'webp' | 'avif' | 'png' | 'gif';

export type VideoFormat = 'mp4' | 'webm' | 'ogg';

export type AudioFormat = 'mp3' | 'ogg';

export type ThumbnailGeneration = 'server' | 'client' | 'smart';
