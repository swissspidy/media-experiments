import { useDispatch, useSelect } from '@wordpress/data';
import { type Settings, store as coreStore } from '@wordpress/core-data';
import { type BlockEditProps } from '@wordpress/blocks';
import { Fragment } from '@wordpress/element';

import { type Attachment } from '@mexp/upload-media';

import { useAttachment } from '../utils/hooks';
import { UploadIndicator } from './uploadIndicator';
import { OptimizeMedia } from './optimizeMediaProps';
import { DebugInfo } from './debugInfo';
import type { SiteLogoBlock } from './types';

type SiteLogoControlsProps = SiteLogoBlock &
	Pick< BlockEditProps< SiteLogoBlock[ 'attributes' ] >, 'setAttributes' >;

export function SiteLogoControls( { attributes }: SiteLogoControlsProps ) {
	const { siteLogoId, canUserEdit } = useSelect( ( select ) => {
		const { canUser, getEditedEntityRecord } = select( coreStore );
		const _canUserEdit = canUser( 'update', 'settings' );
		const siteSettings = _canUserEdit
			? ( getEditedEntityRecord( 'root', 'site', undefined ) as Settings )
			: undefined;
		const _siteLogoId = _canUserEdit ? siteSettings?.site_logo : undefined;

		return {
			siteLogoId: _siteLogoId,
			canUserEdit: _canUserEdit,
		};
	}, [] );

	const { editEntityRecord } = useDispatch( coreStore );
	const attachment = useAttachment( siteLogoId );

	if ( ! siteLogoId || ! attachment || ! canUserEdit ) {
		return null;
	}

	function onChange( media: Partial< Attachment > ) {
		if ( ! media || ! media.id ) {
			return;
		}

		// `shouldForceSync` is used to force syncing when the attribute
		// may not have updated yet.
		if ( attributes.shouldSyncIcon ) {
			void editEntityRecord( 'root', 'site', undefined, {
				site_icon: media.id,
			} );
		}

		void editEntityRecord( 'root', 'site', undefined, {
			site_logo: media.id,
		} );
	}

	return (
		<Fragment>
			<UploadIndicator id={ siteLogoId } />
			<OptimizeMedia
				id={ siteLogoId }
				url={ attachment.source_url }
				onSuccess={ onChange }
			/>
			<DebugInfo id={ siteLogoId } />
		</Fragment>
	);
}
