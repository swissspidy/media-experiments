/**
 * WordPress dependencies
 */
import { useDispatch } from '@wordpress/data';
import { ExternalLink, Guide } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { createInterpolateElement } from '@wordpress/element';
import { store as preferencesStore } from '@wordpress/preferences';

/**
 * Internal dependencies
 */
import { PREFERENCES_NAME } from '../constants';

export function WelcomeGuide() {
	const { toggle } = useDispatch( preferencesStore );

	return (
		<Guide
			className="edit-post-welcome-guide"
			contentLabel={ __(
				'Welcome to media experiments',
				'media-experiments'
			) }
			finishButtonText={ __( 'Get started', 'media-experiments' ) }
			onFinish={ () => toggle( PREFERENCES_NAME, 'welcomeGuide' ) }
			pages={ [
				{
					image: (
						<div className="edit-post-welcome-guide__image">
							<img
								src="https://raw.githubusercontent.com/swissspidy/media-experiments/main/docs/welcome-guide.webp"
								width="512"
								height="224"
								alt=""
							/>
						</div>
					),
					content: (
						<>
							<h1 className="edit-post-welcome-guide__heading">
								{ __(
									'Welcome to media experiments',
									'media-experiments'
								) }
							</h1>
							<p className="edit-post-welcome-guide__text">
								{ __(
									'This experimental WordPress plugin aims to bring improved media capabilities to the block editor.',
									'media-experiments'
								) }
							</p>
							<p className="edit-post-welcome-guide__text">
								{ __(
									'The plugin is generally very stable, but do expect rough edges here and there.',
									'media-experiments'
								) }
							</p>
						</>
					),
				},
				{
					image: (
						<div className="edit-post-welcome-guide__image">
							<img
								src="https://raw.githubusercontent.com/swissspidy/media-experiments/main/docs/welcome-guide.webp"
								width="512"
								height="224"
								alt=""
							/>
						</div>
					),
					content: (
						<>
							<h1 className="edit-post-welcome-guide__heading">
								{ __( 'Bleeding edge', 'media-experiments' ) }
							</h1>
							<p className="edit-post-welcome-guide__text">
								{ __(
									'The plugin should auto-update itself every time there is a new change to the GitHub repository. That means you continuously get new features and most importantly bug fixes.',
									'media-experiments'
								) }
							</p>
							<p className="edit-post-welcome-guide__text">
								{ __(
									'So be on the lookout for new things to try out. Have fun!',
									'media-experiments'
								) }
							</p>
						</>
					),
				},
				{
					image: (
						<div className="edit-post-welcome-guide__image">
							<img
								src="https://raw.githubusercontent.com/swissspidy/media-experiments/main/docs/welcome-guide.webp"
								width="512"
								height="224"
								alt=""
							/>
						</div>
					),
					content: (
						<>
							<h1 className="edit-post-welcome-guide__heading">
								{ __( 'Got stuck?', 'media-experiments' ) }
							</h1>
							<p className="edit-post-welcome-guide__text">
								{ createInterpolateElement(
									__(
										'If you encounter any issues, please <a>file an issue on GitHub.</a>',
										'media-experiments'
									),
									{
										a: (
											// @ts-ignore
											<ExternalLink
												href={ __(
													'https://wordpress.org/documentation/article/wordpress-block-editor/',
													'media-experiments'
												) }
											/>
										),
									}
								) }
							</p>
							<p className="edit-post-welcome-guide__text">
								{ __(
									'Include as much information as possible, such as your browser, the operation you tried and the file the issue happened with.',
									'media-experiments'
								) }
							</p>
						</>
					),
				},
			] }
		/>
	);
}
