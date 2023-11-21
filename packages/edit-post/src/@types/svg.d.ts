declare module '*.svg' {
	import type { FunctionComponent, SVGProps } from 'react';
	const ReactComponent: FunctionComponent<
		SVGProps< SVGElement > & { title?: string }
	>;
	export { ReactComponent };
}
