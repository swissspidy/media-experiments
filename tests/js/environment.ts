// eslint-disable-next-line import/no-extraneous-dependencies
import OriginalEnvironment from 'jest-environment-jsdom';

// See https://github.com/jsdom/jsdom/issues/1724#issuecomment-1446858041
export default class JSDOMEnvironment extends OriginalEnvironment {
	constructor(
		...args: ConstructorParameters< typeof OriginalEnvironment >
	) {
		super( ...args );

		this.global.fetch = fetch;
		this.global.Headers = Headers;
		this.global.Request = Request;
		this.global.Response = Response;
	}
}
