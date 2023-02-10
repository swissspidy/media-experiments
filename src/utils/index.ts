export function getMediaTypeFromMimeType(mimeType: string) {
	return mimeType.split('/')[0];
}
