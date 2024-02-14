// eslint-disable-next-line
import styled from '@emotion/styled';
// eslint-disable-next-line
import * as Ariakit from '@ariakit/react';

export const TabListWrapper = styled.div`
	display: flex;
	align-items: stretch;
	flex-direction: row;
	&[aria-orientation='vertical'] {
		flex-direction: column;
	}
`;

export const Tab = styled( Ariakit.Tab )`
	& {
		display: inline-flex;
		align-items: center;
		position: relative;
		border-radius: 0;
		height: calc( 4px * 12 );
		background: transparent;
		border: none;
		box-shadow: none;
		cursor: pointer;
		padding: 3px calc( 4px * 4 ); // Use padding to offset the [aria-selected="true"] border, this benefits Windows High Contrast mode
		margin-left: 0;
		font-weight: 500;

		&[aria-disabled='true'] {
			cursor: default;
			opacity: 0.3;
		}

		&:hover {
			color: #3858e9;
		}

		&:focus:not( :disabled ) {
			position: relative;
			box-shadow: none;
			outline: none;
		}

		// Tab indicator
		&::after {
			content: '';
			position: absolute;
			right: 0;
			bottom: 0;
			left: 0;
			pointer-events: none;

			// Draw the indicator.
			background: #3858e9;
			height: calc( 0 * var( --wp-admin-border-width-focus ) );
			border-radius: 0;

			// Animation
			transition: all 0.1s linear;

			@media ( prefers-reduced-motion: reduce ) {
				transition-duration: 0ms;
			}
		}

		// Active.
		&[aria-selected='true']::after {
			height: calc( 1 * var( --wp-admin-border-width-focus ) );

			// Windows high contrast mode.
			outline: 2px solid transparent;
			outline-offset: -1px;
		}

		// Focus.
		&::before {
			content: '';
			position: absolute;
			top: calc( 4px * 3 );
			right: calc( 4px * 3 );
			bottom: calc( 4px * 3 );
			left: calc( 4px * 3 );
			pointer-events: none;

			// Draw the indicator.
			box-shadow: 0 0 0 0 transparent;
			border-radius: 2px;

			// Animation
			transition: all 0.1s linear;

			@media ( prefers-reduced-motion: reduce ) {
				transition-duration: 0ms;
			}
		}

		&:focus-visible::before {
			box-shadow: 0 0 0 var( --wp-admin-border-width-focus ) #3858e9;

			// Windows high contrast mode.
			outline: 2px solid transparent;
		}
	}
`;

export const TabPanel = styled( Ariakit.TabPanel )`
	&:focus {
		box-shadow: none;
		outline: none;
	}

	&:focus-visible {
		border-radius: 2px;
		box-shadow: 0 0 0 var( --wp-admin-border-width-focus ) #3858e9;
		// Windows high contrast mode.
		outline: 2px solid transparent;
		outline-offset: 0;
	}
`;
