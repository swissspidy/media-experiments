import { Blob as BlobPolyfill, File as FilePolyfill } from 'node:buffer';

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
