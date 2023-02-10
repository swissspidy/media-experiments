interface MediaRecorderErrorEventInit extends EventInit {
	error: DOMException;
}

declare class MediaRecorderErrorEvent extends Event {
	constructor( type: string, eventInitDict: MediaRecorderErrorEventInit );
	readonly error: DOMException;
}
