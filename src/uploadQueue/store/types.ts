import { WP_REST_API_Attachment } from 'wp-types';
import UploadError from '../uploadError';

export type QueueItemId = string;

export type QueueItem = {
	id: QueueItemId;
	file: File;
	poster?: File;
	attachment?: Attachment;
	status: ItemStatus;
	additionalData: Record<string, string | number>;
	onChange?: OnChangeHandler;
	onSuccess?: OnSuccessHandler;
	onError?: OnErrorHandler;
	transcode?: TranscodingType;
	error?: Error;
};

export type QueueState = {
	queue: QueueItem[];
};

export enum Type {
	Add = 'ADD_ITEM',
	Prepare = 'PREPARE_ITEM',
	TranscodingPrepare = 'TRANSCODING_PREPARE',
	TranscodingStart = 'TRANSCODING_START',
	TranscodingFinish = 'TRANSCODING_FINISH',
	UploadStart = 'UPLOAD_START',
	UploadFinish = 'UPLOAD_FINISH',
	Complete = 'COMPLETE',
	Cancel = 'CANCEL_ITEM',
	Remove = 'REMOVE_ITEM',
	AddPoster = 'ADD_POSTER',
}

export type Attachment = {
	id: number;
	url: string;
	alt: string;
	caption?: string;
	title: string;
	mimeType: string;
	poster?: string;
};

export type OnChangeHandler = (attachments: Partial<Attachment>[]) => void;
export type OnSuccessHandler = (attachments: Partial<Attachment>[]) => void;
export type OnErrorHandler = (error: Error) => void;

export enum ItemStatus {
	Pending = 'PENDING',
	Preparing = 'PREPARING',
	PendingTranscoding = 'PENDING_TRANSCODING',
	Transcoding = 'TRANSCODING',
	Transcoded = 'TRANSCODED',
	Uploading = 'UPLOADING',
	Uploaded = 'UPLOADED',
	Completed = 'COMPLETED',
	Cancelled = 'CANCELLED',
}

export enum TranscodingType {
	Heif = 'HEIF',
	Gif = 'GIF',
	Audio = 'AUDIO',
	Default = 'DEFAULT',
}

// Work around https://github.com/johnbillion/wp-json-schemas/issues/52
export interface RestAttachment extends WP_REST_API_Attachment {
	mime_type: string;
	media_type: 'image' | 'file';
}
