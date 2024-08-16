/**
 * External dependencies
 */
import {
	ReactCompareSlider,
	ReactCompareSliderImage,
} from 'react-compare-slider';

/**
 * WordPress dependencies
 */
import { Button, Modal } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import { createInterpolateElement, useState } from '@wordpress/element';
import { useDispatch, useSelect } from '@wordpress/data';

import { store as uploadStore } from '@mexp/upload-media';

/**
 * Internal dependencies
 */
import { useAttachment } from '../../utils/hooks';

import './editor.css';

const numberFormatter = Intl.NumberFormat( 'en', {
	notation: 'compact',
	style: 'unit',
	unit: 'byte',
	unitDisplay: 'narrow',
	roundingPriority: 'lessPrecision',
	maximumSignificantDigits: 2,
	maximumFractionDigits: 2,
} );

const diffFormatter = Intl.NumberFormat( 'en', {
	notation: 'compact',
	style: 'percent',
	maximumFractionDigits: 2,
} );

interface ApprovalDialogProps {
	id: number;
}

export function ApprovalDialog( { id }: ApprovalDialogProps ) {
	const post = useAttachment( id );
	const { isPendingApproval, comparison } = useSelect(
		( select ) => ( {
			// This allows showing only one approval modal at a time if there
			// are multiple pending items.
			isPendingApproval: id
				? select( uploadStore ).isPendingApprovalByAttachmentId( id )
				: false,
			comparison: id
				? select( uploadStore ).getComparisonDataForApproval( id )
				: null,
		} ),
		[ id ]
	);

	const { rejectApproval, grantApproval } = useDispatch( uploadStore );
	const [ , setOpen ] = useState( false );
	const closeModal = () => setOpen( false );
	const onApprove = () => {
		closeModal();
		void grantApproval( id );
	};

	const onReject = () => {
		closeModal();
		void rejectApproval( id );
	};

	if ( ! post || ! isPendingApproval || ! comparison ) {
		return null;
	}

	return (
		<Modal
			title={ __( 'Compare media quality', 'media-experiments' ) }
			onRequestClose={ onReject }
			size="medium"
		>
			<div className="mexp-comparison-modal__labels">
				<p>
					{ sprintf(
						/* translators: %s: file size. */
						__( 'Old version: %s', 'media-experiments' ),
						numberFormatter.format( comparison.oldSize )
					) }
				</p>
				<p>
					{ sprintf(
						/* translators: %s: file size. */
						__( 'New version: %s', 'media-experiments' ),
						numberFormatter.format( comparison.newSize )
					) }
				</p>
			</div>
			<p>
				{ createInterpolateElement(
					comparison.sizeDiff < 0
						? sprintf(
								/* translators: %s: file size decrease in percent. */
								__(
									'The new version is <b>%s smaller</b>!',
									'media-experiments'
								),
								diffFormatter.format( comparison.sizeDiff )
						  )
						: sprintf(
								/* translators: %s: file size increase in percent. */
								__(
									'The new version is <b>%s bigger</b> :(',
									'media-experiments'
								),
								diffFormatter.format( comparison.sizeDiff )
						  ),
					{
						b: <b />,
					}
				) }
			</p>
			<div className="mexp-comparison-modal__slider">
				<ReactCompareSlider
					itemOne={
						<ReactCompareSliderImage
							src={ comparison.oldUrl }
							alt={ __(
								'Original version',
								'media-experiments'
							) }
						/>
					}
					itemTwo={
						<ReactCompareSliderImage
							src={ comparison.newUrl }
							alt={ __(
								'Optimized version',
								'media-experiments'
							) }
						/>
					}
				/>
			</div>
			<div className="mexp-comparison-modal__buttons">
				<Button variant="secondary" onClick={ onReject }>
					{ __( 'Cancel', 'media-experiments' ) }
				</Button>
				<Button variant="primary" onClick={ onApprove }>
					{ __( 'Use optimized version', 'media-experiments' ) }
				</Button>
			</div>
		</Modal>
	);
}
