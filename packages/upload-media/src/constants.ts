const GB_IN_BYTES = 1024 * 1024 * 1024;
export const MEDIA_TRANSCODING_MAX_FILE_SIZE = 2 * GB_IN_BYTES;

// Roughly what ffmpeg.wasm supports.
// See https://github.com/ffmpegwasm/ffmpeg.wasm-core#configuration
export const TRANSCODABLE_MIME_TYPES = [
	'audio/aac',
	'audio/mp3',
	'audio/mpeg',
	'audio/ogg',
	'audio/wav',
	'image/gif',
	'image/heic',
	'image/heif',
	'image/jpeg',
	'image/png',
	'image/webp',
	'video/3gpp',
	'video/3gpp2',
	'video/MP2T',
	'video/mp4',
	'video/mpeg',
	'video/ogg',
	'video/quicktime',
	'video/webm',
	'video/x-flv',
	'video/x-h261',
	'video/x-h263',
	'video/x-m4v',
	'video/x-matroska',
	'video/x-mjpeg',
	'video/x-ms-asf',
	'video/x-msvideo',
	'video/avi',
	'video/msvideo',
	'video/x-nut',
];

export const PREFERENCES_NAME = 'media-experiments/preferences';
