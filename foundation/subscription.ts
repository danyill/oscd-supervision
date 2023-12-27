import { Edit } from '@openscd/open-scd-core';

export const SCL_NAMESPACE = 'http://www.iec.ch/61850/2003/SCL';

/**
 * Extract the 'name' attribute from the given XML element.
 * @param element - The element to extract name from.
 * @returns the name, or undefined if there is no name.
 */
export function getNameAttribute(element: Element): string | undefined {
  const name = element.getAttribute('name');
  return name || undefined;
}

/**
 * Extract the 'desc' attribute from the given XML element.
 * @param element - The element to extract description from.
 * @returns the name, or undefined if there is no description.
 */
export function getDescriptionAttribute(element: Element): string | undefined {
  const name = element.getAttribute('desc');
  return name || undefined;
}

/** Sorts selected `ListItem`s to the top and disabled ones to the bottom. */
export function compareNames(a: Element | string, b: Element | string): number {
  if (typeof a === 'string' && typeof b === 'string') return a.localeCompare(b);

  if (typeof a === 'object' && typeof b === 'string')
    return (a.getAttribute('name') ?? '').localeCompare(b);

  if (typeof a === 'string' && typeof b === 'object')
    return a.localeCompare(b.getAttribute('name')!);

  if (typeof a === 'object' && typeof b === 'object')
    return (a.getAttribute('name') ?? '').localeCompare(
      b.getAttribute('name') ?? ''
    );

  return 0;
}

/** maximum value for `lnInst` attribute */
const maxLnInst = 99;
const lnInstRange = Array(maxLnInst)
  .fill(1)
  .map((_, i) => `${i + 1}`);

/**
 * @param lnElements - The LN elements to be scanned for `inst`
 * values already in use.
 * @returns first available inst value for LN or undefined if no inst is available
 */
function minAvailableLogicalNodeInstance(
  lnElements: Element[]
): string | undefined {
  const lnInsts = new Set(lnElements.map(ln => ln.getAttribute('inst') || ''));
  return lnInstRange.find(lnInst => !lnInsts.has(lnInst));
}

// TODO: Replace with `tControl/controlBlockObjRef` in scl-lib
// See https://github.com/OpenEnergyTools/scl-lib/issues/73

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

  // check if allowed to modify based on first instance properties
  const supervisionName = supervisionType === 'LGOS' ? 'GoCBRef' : 'SvCBRef';
  const instValKind = firstSupervisionLN!
    .querySelector(`DOI[name="${supervisionName}"]>DAI[name="setSrcRef"]`)
    ?.getAttribute('valKind');
  const instValImport = firstSupervisionLN!
    .querySelector(`DOI[name="${supervisionName}"]>DAI[name="setSrcRef"]`)
    ?.getAttribute('valImport');

  if (
    (instValKind === 'RO' || instValKind === 'Conf') &&
    instValImport === 'true'
  )
    return true;

  // check if allowed to modify based on DataTypeTemplates for first instance
  const rootNode = firstSupervisionLN?.ownerDocument;
  const lNodeType = firstSupervisionLN.getAttribute('lnType');
  const lnClass = firstSupervisionLN.getAttribute('lnClass');
  const dObj = rootNode.querySelector(
    `DataTypeTemplates > LNodeType[id="${lNodeType}"][lnClass="${lnClass}"] > DO[name="${
      lnClass === 'LGOS' ? 'GoCBRef' : 'SvCBRef'
    }"]`
  );
  if (dObj) {
    const dORef = dObj.getAttribute('type');
    const daObj = rootNode.querySelector(
      `DataTypeTemplates > DOType[id="${dORef}"] > DA[name="setSrcRef"]`
    );
    if (daObj) {
      return (
        (daObj.getAttribute('valKind') === 'Conf' ||
          daObj.getAttribute('valKind') === 'RO') &&
        daObj.getAttribute('valImport') === 'true'
      );
    }
  }
  // definition missing
  return false;
}

// NOTE: Have removed the LN0 selector here.

/**
 * Return Val elements within an LGOS/LSVS instance for a particular IED and control block type.
 * @param ied - IED SCL element.
 * @param cbTagName - Either GSEControl or (defaults to) SampledValueControl.
 * @returns an Element array of Val SCL elements within an LGOS/LSVS node.
 */
function getSupervisionCbRefs(ied: Element, cbTagName: string): Element[] {
  const supervisionType = cbTagName === 'GSEControl' ? 'LGOS' : 'LSVS';
  const supervisionName = supervisionType === 'LGOS' ? 'GoCBRef' : 'SvCBRef';
  const selectorString = `LN[lnClass="${supervisionType}"]>DOI[name="${supervisionName}"]>DAI[name="setSrcRef"]>Val`;
  return Array.from(ied.querySelectorAll(selectorString));
}

/**
 * Return Edit actions to remove supervision by clearing the Val element.
 *
 * @param controlBlock The GOOSE or SMV message element
 * @param subscriberIED The subscriber IED
 * @returns an empty array if removing the supervision is not possible or an array
 * with a Delete/Insert action to update the Val element.
 */
export function removeSubscriptionSupervision(
  controlBlock: Element | undefined,
  subscriberIED: Element | undefined
): Edit[] {
  if (!controlBlock || !subscriberIED) return [];
  const valElement = getSupervisionCbRefs(
    subscriberIED,
    controlBlock.tagName
  ).find(val => val.textContent === controlBlockReference(controlBlock));
  if (!valElement) return [];

  const daiElement = valElement.closest('DAI');

  const edits = [];

  // remove old element
  edits.push({
    node: valElement,
  });

  const newValElement = <Element>valElement.cloneNode(true);
  newValElement.textContent = '';

  // add new element
  edits.push({
    parent: daiElement!,
    reference: null,
    node: newValElement,
  });

  return edits;
}

// TODO: Daniel has changed this function
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
export function createNewSupervisionLnInst(
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

  const parent = ied.querySelector(
    `LN[lnClass="${supervisionType}"]`
  )?.parentElement;

  if (parent && newLN) {
    const edit = {
      parent,
      node: newLN,
      reference:
        parent!.querySelector(`LN[lnClass="${supervisionType}"]:last-child`)
          ?.nextElementSibling ?? null,
    };

    return edit;
  }
  return null;
}
