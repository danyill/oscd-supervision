import { canRemoveSupervision } from '@openenergytools/scl-lib/dist/tLN/supervision/removeSupervision.js';

import type { Edit } from '@openscd/open-scd-core';

import { minAvailableLogicalNodeInstance } from '../foundation.js';

const SCL_NAMESPACE = 'http://www.iec.ch/61850/2003/SCL';

/**
 * Creates a string pointer to the control block element.
 *
 * @param controlBlock The GOOSE or SMV message element
 * @returns null if the control block is undefined or a string pointer to the control block element
 */
export function controlBlockReference(
  controlBlock: Element | undefined
): string | null {
  if (!controlBlock) return null;
  const anyLn = controlBlock.closest('LN,LN0');
  const prefix = anyLn?.getAttribute('prefix') ?? '';
  const lnClass = anyLn?.getAttribute('lnClass');
  const lnInst = anyLn?.getAttribute('inst') ?? '';
  const ldInst = controlBlock.closest('LDevice')?.getAttribute('inst');
  const iedName = controlBlock.closest('IED')?.getAttribute('name');
  const cbName = controlBlock.getAttribute('name');
  if (!cbName && !iedName && !ldInst && !lnClass) return null;
  return `${iedName}${ldInst}/${prefix}${lnClass}${lnInst}.${cbName}`;
}

/**
 * Searches for first instantiated LGOS/LSVS LN for presence of DOI>DAI[valKind=Conf/RO][valImport=true]
 * given a supervision type and if necessary then searches DataTypeTemplates for
 * DOType>DA[valKind=Conf/RO][valImport=true] to determine if modifications to supervision are allowed.
 * @param ied - SCL IED element.
 * @param supervisionType - either 'LGOS' or 'LSVS' supervision LN classes.
 * @returns boolean indicating if subscriptions are allowed.
 */
export function isSupervisionModificationAllowed(
  ied: Element,
  supervisionType: string
): boolean {
  const firstSupervisionLN = ied.querySelector(
    `LN[lnClass="${supervisionType}"]`
  );

  // no supervision logical nodes => no new supervision possible
  if (firstSupervisionLN === null) return false;

  return canRemoveSupervision(firstSupervisionLN, {
    removeSupervisionLn: true,
    checkSubscription: false
  });
}

/**
 * Counts the max number of LN instances with supervision allowed for
 * the given control block's type of message.
 *
 * @param subscriberIED The subscriber IED
 * @param controlBlockType The GOOSE or SMV message element
 * @returns The max number of LN instances with supervision allowed
 */
export function maxSupervisions(
  subscriberIED: Element,
  controlBlockType: string
): number {
  const maxAttr = controlBlockType === 'GSEControl' ? 'maxGo' : 'maxSv';
  const maxValues = parseInt(
    subscriberIED
      .querySelector('Services>SupSubscription')
      ?.getAttribute(maxAttr) ?? '0',
    10
  );
  return Number.isNaN(maxValues) ? 0 : maxValues;
}

/** Returns an new LN instance available for supervision instantiation
 *
 * @param controlBlock The GOOSE or SMV message element
 * @param subscriberIED The subscriber IED
 * @returns The LN instance or null if no LN instance could be found or created
 */
function createNewSupervisionLnInst(
  subscriberIED: Element,
  supervisionType: string
): Element | null {
  const newLN = subscriberIED.ownerDocument.createElementNS(
    SCL_NAMESPACE,
    'LN'
  );
  const openScdTag = subscriberIED.ownerDocument.createElementNS(
    SCL_NAMESPACE,
    'Private'
  );
  openScdTag.setAttribute('type', 'OpenSCD.create');
  newLN.appendChild(openScdTag);
  newLN.setAttribute('lnClass', supervisionType);

  // TODO: Why is this here? getSupervisionCbRefs is not of use.
  // Have adjusted to just find the first supervision, no need for it to be instantiated.
  // To create a new LGOS/LSVS LN there should be no need for a Val element to exist somewhere else.
  // const supervisionName = supervisionType === 'LGOS' ? 'GoCBRef' : 'SvCBRef';

  const selectorString = `LN[lnClass="${supervisionType}"],LN0[lnClass="${supervisionType}"]`;

  // TOD: Think as to why this removed portion might be needed...
  // >DOI[name="${supervisionName}"]>DAI[name="setSrcRef"]>Val,
  //   LN0[lnClass="${supervisionType}"]>DOI[name="${supervisionName}"]>DAI[name="setSrcRef"]>Val`;

  const firstSiblingSupervisionLN = Array.from(
    subscriberIED.querySelectorAll(selectorString)
  )[0];

  if (!firstSiblingSupervisionLN) return null;
  newLN.setAttribute(
    'lnType',
    firstSiblingSupervisionLN?.getAttribute('lnType') ?? ''
  );

  /* Before we return, we make sure that LN's inst is unique, non-empty
  and also the minimum inst as the minimum of all available in the IED */
  const inst = newLN.getAttribute('inst') ?? '';
  if (inst === '') {
    const instNumber = minAvailableLogicalNodeInstance(
      Array.from(
        subscriberIED.querySelectorAll(`LN[lnClass="${supervisionType}"]`)
      )
    );
    if (!instNumber) return null;
    newLN.setAttribute('inst', instNumber);
  }
  return newLN;
}

/** Returns an new LN instance available for supervision instantiation
 *
 * @param controlBlock The GOOSE or SMV message element
 * @param subscriberIED The subscriber IED
 * @returns The LN instance or null if no LN instance could be found or created
 */
export function createNewSupervisionLnEvent(
  ied: Element,
  supervisionType: 'LGOS' | 'LSVS'
): Edit | null {
  const newLN = createNewSupervisionLnInst(ied, supervisionType);

  if (!newLN) return null;

  const parent = ied.querySelector(`LN[lnClass="${supervisionType}"]`)
    ?.parentElement;

  if (parent && newLN) {
    const edit = {
      parent,
      node: newLN,
      reference:
        parent!.querySelector(`LN[lnClass="${supervisionType}"]:last-child`)
          ?.nextElementSibling ?? null
    };

    return edit;
  }
  return null;
}
