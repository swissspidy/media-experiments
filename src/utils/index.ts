export function getMediaTypeFromMimeType(mimeType: string) {
	return mimeType.split('/')[0];
}

export function blobToFile(blob: Blob, filename: string, type: string): File {
	return new File([blob], filename, { type });
}
