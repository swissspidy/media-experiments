import { getExtensionFromMimeType } from '../index';

describe('getExtensionFromMimeType', () => {
	it.each([
		['image/jpeg', 'jpeg'],
		['image/png', 'png'],
		['image/webp', 'webp'],
		['video/mp4', 'unknown'],
		['application/pdf', 'unknown'],
	])('for mime type %s returns extension type %s', (mimeType, extension) => {
		expect(getExtensionFromMimeType(mimeType)).toStrictEqual(extension);
	});
});
