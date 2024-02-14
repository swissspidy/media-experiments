/**
 * External dependencies
 */
import type * as React from 'react';

// Copied from packages/components/src/context/wordpress-component.ts in Gutenberg.
// Based on https://github.com/ariakit/ariakit/blob/reakit/packages/reakit-utils/src/types.ts
export type WordPressComponentProps<
	/** Prop types. */
	P,
	/** The HTML element to inherit props from. */
	T extends React.ElementType | null,
	/** Supports polymorphism through the `as` prop. */
	IsPolymorphic extends boolean = true,
> = P &
	( T extends React.ElementType
		? // The `children` prop is being explicitly omitted since it is otherwise implicitly added
		  // by `ComponentPropsWithRef`. The context is that components should require the `children`
		  // prop explicitly when needed (see https://github.com/WordPress/gutenberg/pull/31817).
		  Omit<
				React.ComponentPropsWithoutRef< T >,
				'as' | keyof P | 'children'
		  >
		: {} ) &
	( IsPolymorphic extends true
		? {
				/** The HTML element or React component to render the component as. */
				as?: T | keyof JSX.IntrinsicElements;
		  }
		: {} );
