export function getMediaTypeFromMimeType(mimeType: string) {
	return mimeType.split('/')[0];
}

export function getMediaTypeFromBlockName(blockName: string) {
	switch (blockName) {
		case 'core/video':
			return 'video';
		case 'core/image':
			return 'image';
		case 'core/audio':
			return 'audio';
		default:
			return null;
	}
}

export function blobToFile(blob: Blob, filename: string, type: string): File {
	return new File([blob], filename, { type });
}
