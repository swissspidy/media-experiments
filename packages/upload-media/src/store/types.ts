import type { WP_REST_API_Attachment, WP_REST_API_Term } from 'wp-types';

export type { WP_REST_API_Term };

export type QueueItemId = string;

export type QueueItem = {
	id: QueueItemId;
	sourceFile: File;
	file: File;
	poster?: File;
	attachment?: Attachment;
	status: ItemStatus;
	additionalData: AdditionalData;
	onChange?: OnChangeHandler;
	onSuccess?: OnSuccessHandler;
	onError?: OnErrorHandler;
	transcode?: TranscodingType;
	error?: Error;
	sourceUrl?: string;
	sourceAttachmentId?: number; // TODO: implement.
	mediaSourceTerms?: string[];
	blurHash?: string;
	dominantColor?: string;
	generatedPosterId?: number;
	needsApproval?: boolean;
};

export interface State {
	queue: QueueItem[];
	mediaSourceTerms: Record< string, number >;
}

export enum Type {
	Unknown = 'REDUX_UNKNOWN',
	Add = 'ADD_ITEM',
	Prepare = 'PREPARE_ITEM',
	TranscodingPrepare = 'TRANSCODING_PREPARE',
	TranscodingStart = 'TRANSCODING_START',
	TranscodingFinish = 'TRANSCODING_FINISH',
	UploadStart = 'UPLOAD_START',
	UploadFinish = 'UPLOAD_FINISH',
	Cancel = 'CANCEL_ITEM',
	Remove = 'REMOVE_ITEM',
	AddPoster = 'ADD_POSTER',
	SetMediaSourceTerms = 'ADD_MEDIA_SOURCE_TERMS',
	RequestApproval = 'REQUEST_APPROVAL',
	ApproveUpload = 'APPROVE_UPLOAD',
}

type Action< T = Type, Payload = {} > = {
	type: T;
} & Payload;

export type UnknownAction = Action< Type.Unknown >;
export type AddAction = Action< Type.Add, { item: QueueItem } >;
export type PrepareAction = Action< Type.Prepare, { id: QueueItemId } >;
export type RequestApprovalAction = Action<
	Type.RequestApproval,
	{ id: QueueItemId; file: File; url: string }
>;
export type ApproveUploadAction = Action<
	Type.ApproveUpload,
	{ id: QueueItemId }
>;
export type TranscodingPrepareAction = Action<
	Type.TranscodingPrepare,
	{ id: QueueItemId; transcode: TranscodingType }
>;
export type TranscodingStartAction = Action<
	Type.TranscodingStart,
	{ id: QueueItemId }
>;
export type TranscodingFinishAction = Action<
	Type.TranscodingFinish,
	{ id: QueueItemId; file: File; url: string }
>;
export type UploadStartAction = Action< Type.UploadStart, { id: QueueItemId } >;
export type UploadFinishAction = Action<
	Type.UploadFinish,
	{ id: QueueItemId; attachment: Attachment }
>;
export type CancelAction = Action<
	Type.Cancel,
	{ id: QueueItemId; error: Error }
>;
export type RemoveAction = Action< Type.Remove, { id: QueueItemId } >;
export type AddPosterAction = Action<
	Type.AddPoster,
	{ id: QueueItemId; file: File; url: string }
>;
export type SetMediaSourceTermsAction = Action<
	Type.SetMediaSourceTerms,
	{ terms: Record< string, number > }
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
};

export type OnChangeHandler = ( attachments: Partial< Attachment >[] ) => void;
export type OnSuccessHandler = ( attachments: Partial< Attachment >[] ) => void;
export type OnErrorHandler = ( error: Error ) => void;

export enum ItemStatus {
	Pending = 'PENDING',
	Preparing = 'PREPARING',
	PendingTranscoding = 'PENDING_TRANSCODING',
	Transcoding = 'TRANSCODING',
	Transcoded = 'TRANSCODED',
	PendingApproval = 'PENDING_APPROVAL',
	Approved = 'APPROVED',
	Uploading = 'UPLOADING',
	Uploaded = 'UPLOADED',
	Cancelled = 'CANCELLED',
}

export enum TranscodingType {
	Heif = 'HEIF',
	Gif = 'GIF',
	Audio = 'AUDIO',
	MuteVideo = 'MUTE_VIDEO',
	OptimizeExisting = 'OPTIMIZE_EXISTING',
	Default = 'DEFAULT',
}

export interface RestAttachment extends WP_REST_API_Attachment {
	featured_media: number;
	mexp_media_source: number[];
	meta: {
		mexp_blurhash?: string;
		mexp_dominant_color?: string;
		mexp_is_muted?: boolean;
		mexp_generated_poster_id?: number;
	};
}

export type CreateRestAttachment = Partial< RestAttachment >;

export type AdditionalData = Omit<
	CreateRestAttachment,
	'meta' | 'mexp_media_source'
>;
