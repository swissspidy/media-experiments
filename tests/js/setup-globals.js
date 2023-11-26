import { Blob as BlobPolyfill, File as FilePolyfill } from 'blob-polyfill';
// https://github.com/jsdom/jsdom/issues/2555
global.Blob = BlobPolyfill;
global.File = FilePolyfill;

// See https://github.com/jsdom/jsdom/issues/1721
if ( typeof window.URL.createObjectURL === 'undefined' ) {
	Object.defineProperty( window.URL, 'createObjectURL', {
		value: jest.fn().mockImplementation( () => {
			return 'blob:foobar';
		} ),
	} );
}
