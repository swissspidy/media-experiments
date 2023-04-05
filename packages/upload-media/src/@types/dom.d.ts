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
	[Symbol.iterator](): IterableIterator<AudioTrack>;
	length: number;
}

interface HTMLVideoElement {
	readonly audioTracks?: AudioTrackList;
	readonly mozHasAudio?: boolean;
	readonly webkitAudioDecodedByteCount?: number;
}
