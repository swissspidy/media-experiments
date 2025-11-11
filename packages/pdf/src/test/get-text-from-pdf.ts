/**
 * Internal dependencies
 */
import { getTextFromPdf } from '../index';

// Mock pdfjs-dist
jest.mock( 'pdfjs-dist', () => ( {
	GlobalWorkerOptions: {
		workerSrc: '',
	},
	getDocument: jest.fn(),
} ) );

describe( 'getTextFromPdf', () => {
	beforeEach( () => {
		jest.clearAllMocks();
	} );

	it( 'should extract text from a PDF with one page', async () => {
		const mockTextContent = {
			items: [
				{ str: 'Hello' },
				{ str: 'World' },
				{ str: 'This is a test' },
			],
			styles: {},
			lang: null,
		};

		const mockPage = {
			getTextContent: jest.fn().mockResolvedValue( mockTextContent ),
		};

		const mockPdf = {
			numPages: 1,
			getPage: jest.fn().mockResolvedValue( mockPage ),
		};

		const { getDocument } = await import( 'pdfjs-dist' );
		( getDocument as jest.Mock ).mockReturnValue( {
			promise: Promise.resolve( mockPdf ),
		} );

		const result = await getTextFromPdf( 'test.pdf' );

		expect( result ).toEqual( [ 'Hello World This is a test' ] );
		expect( mockPdf.getPage ).toHaveBeenCalledWith( 1 );
	} );

	it( 'should extract text from a PDF with multiple pages', async () => {
		const mockTextContent1 = {
			items: [ { str: 'Page 1 content' } ],
			styles: {},
			lang: null,
		};

		const mockTextContent2 = {
			items: [ { str: 'Page 2 content' } ],
			styles: {},
			lang: null,
		};

		const mockPage1 = {
			getTextContent: jest.fn().mockResolvedValue( mockTextContent1 ),
		};

		const mockPage2 = {
			getTextContent: jest.fn().mockResolvedValue( mockTextContent2 ),
		};

		const mockPdf = {
			numPages: 2,
			getPage: jest
				.fn()
				.mockResolvedValueOnce( mockPage1 )
				.mockResolvedValueOnce( mockPage2 ),
		};

		const { getDocument } = await import( 'pdfjs-dist' );
		( getDocument as jest.Mock ).mockReturnValue( {
			promise: Promise.resolve( mockPdf ),
		} );

		const result = await getTextFromPdf( 'test.pdf' );

		expect( result ).toEqual( [ 'Page 1 content', 'Page 2 content' ] );
		expect( mockPdf.getPage ).toHaveBeenCalledTimes( 2 );
	} );

	it( 'should skip empty pages', async () => {
		const mockTextContent1 = {
			items: [ { str: 'Page 1 content' } ],
			styles: {},
			lang: null,
		};

		const mockTextContent2 = {
			items: [ { str: '   ' }, { str: '' } ],
			styles: {},
			lang: null,
		};

		const mockTextContent3 = {
			items: [ { str: 'Page 3 content' } ],
			styles: {},
			lang: null,
		};

		const mockPage1 = {
			getTextContent: jest.fn().mockResolvedValue( mockTextContent1 ),
		};

		const mockPage2 = {
			getTextContent: jest.fn().mockResolvedValue( mockTextContent2 ),
		};

		const mockPage3 = {
			getTextContent: jest.fn().mockResolvedValue( mockTextContent3 ),
		};

		const mockPdf = {
			numPages: 3,
			getPage: jest
				.fn()
				.mockResolvedValueOnce( mockPage1 )
				.mockResolvedValueOnce( mockPage2 )
				.mockResolvedValueOnce( mockPage3 ),
		};

		const { getDocument } = await import( 'pdfjs-dist' );
		( getDocument as jest.Mock ).mockReturnValue( {
			promise: Promise.resolve( mockPdf ),
		} );

		const result = await getTextFromPdf( 'test.pdf' );

		expect( result ).toEqual( [ 'Page 1 content', 'Page 3 content' ] );
	} );

	it( 'should handle items without str property', async () => {
		const mockTextContent = {
			items: [
				{ str: 'Hello' },
				{ type: 'marked' }, // Item without str property
				{ str: 'World' },
			],
			styles: {},
			lang: null,
		};

		const mockPage = {
			getTextContent: jest.fn().mockResolvedValue( mockTextContent ),
		};

		const mockPdf = {
			numPages: 1,
			getPage: jest.fn().mockResolvedValue( mockPage ),
		};

		const { getDocument } = await import( 'pdfjs-dist' );
		( getDocument as jest.Mock ).mockReturnValue( {
			promise: Promise.resolve( mockPdf ),
		} );

		const result = await getTextFromPdf( 'test.pdf' );

		expect( result ).toEqual( [ 'Hello World' ] );
	} );

	it( 'should return an empty array for a PDF with no text', async () => {
		const mockTextContent = {
			items: [],
			styles: {},
			lang: null,
		};

		const mockPage = {
			getTextContent: jest.fn().mockResolvedValue( mockTextContent ),
		};

		const mockPdf = {
			numPages: 1,
			getPage: jest.fn().mockResolvedValue( mockPage ),
		};

		const { getDocument } = await import( 'pdfjs-dist' );
		( getDocument as jest.Mock ).mockReturnValue( {
			promise: Promise.resolve( mockPdf ),
		} );

		const result = await getTextFromPdf( 'test.pdf' );

		expect( result ).toEqual( [] );
	} );
} );
