import {
	MEDIA_TRANSCODING_MAX_FILE_SIZE,
	TRANSCODABLE_MIME_TYPES,
} from './constants';

// TODO: Make work for HEIF, GIF and audio as well.
export function canTranscodeFile(file: File) {
	return (
		window?.crossOriginIsolated &&
		TRANSCODABLE_MIME_TYPES.includes(file.type) &&
		file.size <= MEDIA_TRANSCODING_MAX_FILE_SIZE
	);
}

/**
 * Browsers may use unexpected mime types, and they differ from browser to browser.
 * This function computes a flexible array of mime types from the mime type structured provided by the server.
 * Converts { jpg|jpeg|jpe: "image/jpeg" } into [ "image/jpeg", "image/jpg", "image/jpeg", "image/jpe" ]
 * The computation of this array instead of directly using the object,
 * solves the problem in chrome where mp3 files have audio/mp3 as mime type instead of audio/mpeg.
 * https://bugs.chromium.org/p/chromium/issues/detail?id=227004
 *
 * @param {?Object} wpMimeTypesObject Mime type object received from the server.
 *                                    Extensions are keys separated by '|' and values are mime types associated with an extension.
 *
 * @return {?Array} An array of mime types.
 */
export function getMimeTypesArray(
	wpMimeTypesObject?: Record<string, string> | null
) {
	if (!wpMimeTypesObject) {
		return [];
	}
	return Object.entries(wpMimeTypesObject)
		.map(([extensionsString, mime]) => {
			const [type] = mime.split('/');
			const extensions = extensionsString.split('|');
			return [
				mime,
				...extensions.map((extension) => `${type}/${extension}`),
			];
		})
		.flat();
}

/**
 * Get the file extension for a given mime type.
 *
 * Good enough for the use case here, but ideally this
 * would come from a mime database.
 *
 * @param mimeType Mime type.
 * @return File extension.
 */
export function getExtensionFromMimeType(mimeType: string) {
	// Verbose but readable.
	switch (mimeType) {
		case 'image/jpeg':
			return 'jpeg';
		case 'image/png':
			return 'png';
		case 'image/webp':
			return 'webp';
		default:
			return 'unknown';
	}
}

export function getFileBasename(name: string): string {
	return name.includes('.') ? name.split('.').slice(0, -1).join('.') : name;
}

/**
 * Returns the file name including extension from a URL.
 *
 * @param url File URL.
 * @return File name.
 */
export function getFileNameFromUrl(url: string): string {
	const tail = url.split('/').at(-1);
	return tail.split(/[#?]/).at(0) ?? tail;
}

export function getCanvasBlob(
	canvasEl: HTMLCanvasElement,
	type: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/jpeg',
	quality = 0.82
): Promise<Blob | null> {
	return new Promise((resolve, reject) => {
		canvasEl.toBlob(
			(blob) =>
				blob
					? resolve(blob)
					: reject(new Error('Could not get canvas blob')),
			type,
			quality
		);
	});
}

export function blobToFile(blob: Blob, filename: string, type: string): File {
	return new File([blob], filename, { type });
}

export async function bufferToBlob(
	buffer: ArrayBuffer,
	width: number,
	height: number,
	type: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/webp',
	quality = 0.82
) {
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;

	const ctx = canvas.getContext('2d');

	if (!ctx) {
		throw new Error('Could not get context');
	}

	const imageData = new ImageData(
		new Uint8ClampedArray(buffer),
		width,
		height
	);

	ctx.putImageData(imageData, 0, 0);

	return getCanvasBlob(canvas, type, quality);
}

function preloadVideoMetadata(src: string): Promise<HTMLVideoElement> {
	const video = document.createElement('video');
	video.muted = true;
	video.crossOrigin = 'anonymous';
	video.preload = 'metadata';

	return new Promise((resolve, reject) => {
		video.addEventListener('loadedmetadata', () => resolve(video));
		video.addEventListener('error', reject);

		video.src = src;
	});
}

async function preloadVideo(src: string): Promise<HTMLVideoElement> {
	const video = await preloadVideoMetadata(src);

	return new Promise((resolve, reject) => {
		video.addEventListener('canplay', () => resolve(video), { once: true });
		video.addEventListener('error', reject);

		video.preload = 'auto';
	});
}

function seekVideo(video: HTMLVideoElement, offset = 0.99): Promise<void> {
	if (video.currentTime === offset) {
		return Promise.resolve();
	}

	return new Promise((resolve, reject) => {
		// If the seek takes longer 3 seconds, guess it timed out and error out.
		video.addEventListener('seeking', (evt) => {
			const wait = setTimeout(() => {
				clearTimeout(wait);
				reject(evt);
			}, 3000 /* 3 seconds */);
		});
		video.addEventListener('error', reject);
		video.addEventListener('seeked', () => resolve(), { once: true });

		video.currentTime = offset;
	});
}

export async function getPosterFromVideo(
	src: string,
	basename: string,
	type: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/webp',
	quality = 0.82
) {
	let blob = await getFirstFrameOfVideo(src, type, quality);

	// Safari does not support WebP and falls back to PNG.
	// Use JPEG instead of PNG in that case.
	if (type === 'image/webp' && blob.type !== 'image/webp') {
		blob = await getFirstFrameOfVideo(src, 'image/jpeg', quality);
	}

	return blobToFile(
		blob,
		`${basename}.${getExtensionFromMimeType(blob.type)}`,
		blob.type
	);
}

export async function getFirstFrameOfVideo(
	src: string,
	type: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/webp',
	quality = 0.82
) {
	const video = await preloadVideo(src);
	await seekVideo(video);
	return getImageFromVideo(video, type, quality);
}

export function getImageFromVideo(
	video: HTMLVideoElement,
	type: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/webp',
	quality = 0.82
) {
	const canvas = document.createElement('canvas');
	canvas.width = video.videoWidth;
	canvas.height = video.videoHeight;

	const ctx = canvas.getContext('2d');

	// If the contextType doesn't match a possible drawing context,
	// or differs from the first contextType requested, null is returned.
	if (!ctx) {
		throw new Error('Could not get context');
	}

	ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
	return getCanvasBlob(canvas, type, quality);
}

export function isHeifImage(buffer: ArrayBuffer) {
	const fourCC = String.fromCharCode(
		...Array.from(new Uint8Array(buffer.slice(8, 12)))
	);

	const validFourCC = [
		'mif1', // .heic / image/heif
		'msf1', // .heic / image/heif-sequence
		'heic', // .heic / image/heic
		'heix', // .heic / image/heic
		'hevc', // .heic / image/heic-sequence
		'hevx', // .heic / image/heic-sequence
	];

	return validFourCC.includes(fourCC);
}

/**
 * Whether an image is an animated GIF.
 *
 * Loosely based on https://www.npmjs.com/package/animated-gif-detector (MIT-compatible ISC license)
 *
 * See http://www.matthewflickinger.com/lab/whatsinagif/bits_and_bytes.asp for how GIFs are structured.
 *
 * @param buffer The GIF ArrayBuffer instance.
 * @return Whether this is an animated GIF or not.
 */
export function isAnimatedGif(buffer: ArrayBuffer): boolean {
	// See http://www.matthewflickinger.com/lab/whatsinagif/bits_and_bytes.asp.
	const BLOCK_TERMINATOR = 0x00;
	const EXTENSION_INTRODUCER = 0x21;
	const GRAPHIC_CONTROL_LABEL = 0xf9;

	const arr = new Uint8Array(buffer);
	let frames = 0;

	// Make sure it's a GIF and skip early if it isn't.
	// 47="G", 49="I", 46="F", 38="8"
	if (
		arr[0] !== 0x47 ||
		arr[1] !== 0x49 ||
		arr[2] !== 0x46 ||
		arr[3] !== 0x38
	) {
		return false;
	}

	for (let i = 4; i < arr.length; i++) {
		// We reached a new block, increase frame count.
		if (
			arr[i] === BLOCK_TERMINATOR &&
			arr[i + 1] === EXTENSION_INTRODUCER &&
			arr[i + 2] === GRAPHIC_CONTROL_LABEL
		) {
			frames++;
		}
	}

	return frames > 1;
}
