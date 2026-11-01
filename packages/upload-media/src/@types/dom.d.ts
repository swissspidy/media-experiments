// See https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-9.html#more-libdomdts-refinements

interface AudioTrack {
	enabled: boolean;
	id: string;
	kind:
		| 'alternative'
		| 'descriptions'
		| 'main'
		| 'main-desc'
		| 'translation'
		| 'commentary'
		| '';
	label: string;
	language: string;
	sourceBuffer: SourceBuffer | null;
}

interface AudioTrackList {
	[Symbol.iterator](): IterableIterator< AudioTrack >;
	length: number;
}

interface VideoFrameMetadata {
	presentationTime: DOMHighResTimeStamp;
	expectedDisplayTime: DOMHighResTimeStamp;
	width: number;
	height: number;
	mediaTime: number;
	presentedFrames: number;
	processingDuration?: number;
	captureTime?: DOMHighResTimeStamp;
	receiveTime?: DOMHighResTimeStamp;
	rtpTimestamp?: number;
}

interface VideoFrameRequestCallback {
	(
		now: DOMHighResTimeStamp,
		metadata: VideoFrameMetadata
	): void;
}

interface HTMLVideoElement {
	readonly audioTracks?: AudioTrackList;
	readonly mozHasAudio?: boolean;
	readonly webkitAudioDecodedByteCount?: number;
	requestVideoFrameCallback?(
		callback: VideoFrameRequestCallback
	): number;
	cancelVideoFrameCallback?( handle: number ): void;
}
