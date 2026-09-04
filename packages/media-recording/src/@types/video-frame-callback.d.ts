// Type definitions for requestVideoFrameCallback API
// See https://wicg.github.io/video-rvfc/

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
	requestVideoFrameCallback?(
		callback: VideoFrameRequestCallback
	): number;
	cancelVideoFrameCallback?( handle: number ): void;
}
