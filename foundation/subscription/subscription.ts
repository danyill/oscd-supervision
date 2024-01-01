import { Edit, Insert, Remove } from '@openscd/open-scd-core';

import { minAvailableLogicalNodeInstance } from '../foundation.js';

export const SCL_NAMESPACE = 'http://www.iec.ch/61850/2003/SCL';

/**
 * Simple function to check if the attribute of the Left Side has the same value as the attribute of the Right Element.
 *
 * @param leftElement   - The Left Element to check against.
 * @param rightElement  - The Right Element to check.
 * @param attributeName - The name of the attribute to check.
 */
export function sameAttributeValue(
  leftElement: Element | undefined,
  rightElement: Element | undefined,
  attributeName: string
): boolean {
  return (
    (leftElement?.getAttribute(attributeName) ?? '') ===
    (rightElement?.getAttribute(attributeName) ?? '')
  );
}

/**
 * Simple function to check if the attribute of the Left Side has the same value as the attribute of the Right Element.
 *
 * @param leftElement        - The Left Element to check against.
 * @param leftAttributeName  - The name of the attribute (left) to check against.
 * @param rightElement       - The Right Element to check.
 * @param rightAttributeName - The name of the attribute (right) to check.
 */
export function sameAttributeValueDiffName(
  leftElement: Element | undefined,
  leftAttributeName: string,
  rightElement: Element | undefined,
  rightAttributeName: string
): boolean {
  return (
    (leftElement?.getAttribute(leftAttributeName) ?? '') ===
    (rightElement?.getAttribute(rightAttributeName) ?? '')
  );
}

export type SclEdition = '2003' | '2007B' | '2007B4';
export function getSclSchemaVersion(doc: Document): SclEdition {
  const scl: Element = doc.documentElement;
  const edition =
    (scl.getAttribute('version') ?? '2003') +
    (scl.getAttribute('revision') ?? '') +
    (scl.getAttribute('release') ?? '');
  return <SclEdition>edition;
}

export const serviceTypes: Partial<Record<string, string>> = {
  ReportControl: 'Report',
  GSEControl: 'GOOSE',
  SampledValueControl: 'SMV'
};

/**
 * If needed check version specific attributes against FCDA Element.
 *
 * @param controlTagName     - Indicates which type of control element.
 * @param controlElement - The Control Element to check against.
 * @param extRefElement  - The Ext Ref Element to check.
 */
function checkEditionSpecificRequirements(
  controlTagName: 'SampledValueControl' | 'GSEControl',
  controlElement: Element | undefined,
  extRefElement: Element
): boolean {
  // For 2003 Edition no extra check needed.
  if (getSclSchemaVersion(extRefElement.ownerDocument) === '2003') {
    return true;
  }

  const lDeviceElement = controlElement?.closest('LDevice') ?? undefined;
  const lnElement = controlElement?.closest('LN0') ?? undefined;

  // For the 2007B and 2007B4 Edition we need to check some extra attributes.
  return (
    (extRefElement.getAttribute('serviceType') ?? '') ===
      serviceTypes[controlTagName] &&
    sameAttributeValueDiffName(
      extRefElement,
      'srcLDInst',
      lDeviceElement,
      'inst'
    ) &&
    sameAttributeValueDiffName(
      extRefElement,
      'srcPrefix',
      lnElement,
      'prefix'
    ) &&
    sameAttributeValueDiffName(
      extRefElement,
      'srcLNClass',
      lnElement,
      'lnClass'
    ) &&
    sameAttributeValueDiffName(extRefElement, 'srcLNInst', lnElement, 'inst') &&
    sameAttributeValueDiffName(
      extRefElement,
      'srcCBName',
      controlElement,
      'name'
    )
  );
}

/**
 * Check if the ExtRef is already subscribed to a FCDA Element.
 *
 * @param extRefElement - The Ext Ref Element to check.
 */
export function isSubscribed(extRefElement: Element): boolean {
  return (
    extRefElement.hasAttribute('iedName') &&
    extRefElement.hasAttribute('ldInst') &&
    extRefElement.hasAttribute('lnClass') &&
    extRefElement.hasAttribute('lnInst') &&
    extRefElement.hasAttribute('doName') &&
    extRefElement.hasAttribute('daName')
  );
}

/**
 * Check if specific attributes from the ExtRef Element are the same as the ones from the FCDA Element
 * and also if the IED Name is the same. If that is the case this ExtRef subscribes to the selected FCDA
 * Element.
 *
 * @param controlTagName - Indicates which type of control element.
 * @param controlElement - The Control Element to check against.
 * @param fcdaElement    - The FCDA Element to check against.
 * @param extRefElement  - The Ext Ref Element to check.
 */
export function isSubscribedTo(
  controlTagName: 'SampledValueControl' | 'GSEControl',
  controlElement: Element | undefined,
  fcdaElement: Element | undefined,
  extRefElement: Element
): boolean {
  return (
    extRefElement.getAttribute('iedName') ===
      fcdaElement?.closest('IED')?.getAttribute('name') &&
    sameAttributeValue(fcdaElement, extRefElement, 'ldInst') &&
    sameAttributeValue(fcdaElement, extRefElement, 'prefix') &&
    sameAttributeValue(fcdaElement, extRefElement, 'lnClass') &&
    sameAttributeValue(fcdaElement, extRefElement, 'lnInst') &&
    sameAttributeValue(fcdaElement, extRefElement, 'doName') &&
    sameAttributeValue(fcdaElement, extRefElement, 'daName') &&
    checkEditionSpecificRequirements(
      controlTagName,
      controlElement,
      extRefElement
    )
  );
}

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

export function findFCDAs(extRef: Element): Element[] {
  if (extRef.tagName !== 'ExtRef' || extRef.closest('Private')) return [];

  const [iedName, ldInst, prefix, lnClass, lnInst, doName, daName] = [
    'iedName',
    'ldInst',
    'prefix',
    'lnClass',
    'lnInst',
    'doName',
    'daName'
  ].map(name => extRef.getAttribute(name));
  const ied = Array.from(extRef.ownerDocument.getElementsByTagName('IED')).find(
    element =>
      element.getAttribute('name') === iedName && !element.closest('Private')
  );
  if (!ied) return [];

  return Array.from(ied.getElementsByTagName('FCDA'))
    .filter(item => !item.closest('Private'))
    .filter(
      fcda =>
        (fcda.getAttribute('ldInst') ?? '') === (ldInst ?? '') &&
        (fcda.getAttribute('prefix') ?? '') === (prefix ?? '') &&
        (fcda.getAttribute('lnClass') ?? '') === (lnClass ?? '') &&
        (fcda.getAttribute('lnInst') ?? '') === (lnInst ?? '') &&
        (fcda.getAttribute('doName') ?? '') === (doName ?? '') &&
        (fcda.getAttribute('daName') ?? '') === (daName ?? '')
    );
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
 * Return an array with a single Remove action to delete the supervision element
 * for the given GOOSE/SMV message and subscriber IED.
 *
 * @param controlBlock The GOOSE or SMV message element
 * @param subscriberIED The subscriber IED
 * @returns an empty array if removing the supervision is not possible or an array
 * with a single Delete action that removes the LN if it was created in OpenSCD
 * or only the supervision structure DOI/DAI/Val if it was created by the user.
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
    node: valElement
  });

  const newValElement = <Element>valElement.cloneNode(true);
  newValElement.textContent = '';

  // add new element
  edits.push({
    parent: daiElement!,
    reference: null,
    node: newValElement
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

/**
 * Counts the number of LN instances with proper supervision for the given control block set up.
 *
 * @param subscriberIED - The subscriber IED.
 * @param controlBlock - The GOOSE or SMV message element.
 * @returns The number of LN instances with a supervision set up.
 */
function instantiatedSupervisionsCount(
  subscriberIED: Element,
  controlBlock: Element
): number {
  const instantiatedValues = getSupervisionCbRefs(
    subscriberIED,
    controlBlock.tagName
  ).filter(val => val.textContent !== '');
  return instantiatedValues.length;
}

/**
 * Checks if the given combination of GOOSE/SMV message and subscriber IED
 * allows for subscription supervision.
 * @param controlBlock The GOOSE or SMV message element
 * @param subscriberIED The subscriber IED
 * @param supervisionType LSVS or LGOS
 * @returns true if both controlBlock and subscriberIED meet the requirements for
 * setting up a supervision for the specified supervision type or false if they don't
 */
function isSupervisionAllowed(
  controlBlock: Element,
  subscriberIED: Element,
  supervisionType: string
): boolean {
  if (getSclSchemaVersion(subscriberIED.ownerDocument) === '2003') return false;
  if (subscriberIED.querySelector(`LN[lnClass="${supervisionType}"]`) === null)
    return false;
  if (
    getSupervisionCbRefs(subscriberIED, controlBlock.tagName).find(
      val => val.textContent === controlBlockReference(controlBlock)
    )
  )
    return false;
  if (
    maxSupervisions(subscriberIED, controlBlock.tagName) <=
    instantiatedSupervisionsCount(subscriberIED, controlBlock)
  )
    return false;

  return true;
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

/* TODO: Update and add proper unit tests, needs to be changed for subscriber plugin */

/** Returns an new or existing LN instance available for supervision instantiation
 *
 * @param controlBlock The GOOSE or SMV message element
 * @param subscriberIED The subscriber IED
 * @returns The LN instance or null if no LN instance could be found or created
 */
export function findOrCreateAvailableLNInst(
  controlBlock: Element,
  subscriberIED: Element,
  supervisionType: string
): Element | null {
  let availableLN =
    Array.from(
      subscriberIED.querySelectorAll(`LN[lnClass="${supervisionType}"]`)
    ).find(ln => {
      const supervisionName =
        supervisionType === 'LGOS' ? 'GoCBRef' : 'SvCBRef';
      // TODO: What about overriding incorrect values? Do we need an edit to do manual fixes?
      return (
        ln.querySelector(
          `DOI[name="${supervisionName}"]>DAI[name="setSrcRef"]>Val`
        ) === null ||
        ln.querySelector(
          `DOI[name="${supervisionName}"]>DAI[name="setSrcRef"]>Val`
        )?.textContent === ''
      );
    }) ?? null;

  if (!availableLN) {
    availableLN = createNewSupervisionLnInst(subscriberIED, supervisionType);
  }

  return availableLN;
}

// IMPORTANT: Has been updated by Daniel to add existingSupervision
// TODO: But does it correctly check that modifications are allowed? Probably.

/**
 * Returns an array with a single Insert Edit to create a new
 * supervision element for the given GOOSE/SMV message and subscriber IED.
 *
 * @param controlBlock The GOOSE or SMV message element
 * @param subscriberIED The subscriber IED
 * @returns an empty array if instantiation is not possible or an array with a single Create action
 */
export function instantiateSubscriptionSupervision(
  controlBlock: Element | undefined,
  subscriberIED: Element | undefined,
  existingSupervision: Element | undefined = undefined
): (Insert | Remove)[] {
  const supervisionType =
    controlBlock?.tagName === 'GSEControl' ? 'LGOS' : 'LSVS';
  if (
    !controlBlock ||
    !subscriberIED ||
    !isSupervisionAllowed(controlBlock, subscriberIED, supervisionType)
  )
    return [];
  const availableLN =
    existingSupervision ??
    findOrCreateAvailableLNInst(controlBlock, subscriberIED, supervisionType);
  if (
    !availableLN ||
    !isSupervisionModificationAllowed(subscriberIED, supervisionType)
  )
    return [];

  const edits: (Insert | Remove)[] = [];
  // If creating new LN element
  if (!availableLN.parentElement) {
    const parent = subscriberIED.querySelector(
      `LN[lnClass="${supervisionType}"]`
    )?.parentElement;
    if (parent) {
      // use Insert edit for supervision LN
      edits.push({
        parent,
        node: availableLN,
        reference:
          parent!.querySelector(`LN[lnClass="${supervisionType}"]:last-child`)
            ?.nextElementSibling ?? null
      });
    }
  }

  // Insert child elements
  const supervisionName = supervisionType === 'LGOS' ? 'GoCBRef' : 'SvCBRef';

  let doiElement = availableLN.querySelector(`DOI[name="${supervisionName}"]`);
  if (!doiElement) {
    doiElement = subscriberIED.ownerDocument.createElementNS(
      SCL_NAMESPACE,
      'DOI'
    );
    doiElement.setAttribute('name', supervisionName);
    edits.push({
      parent: availableLN!,
      reference: null,
      node: doiElement
    });
  }

  let daiElement = availableLN.querySelector(
    `DOI[name="${supervisionName}"]>DAI[name="setSrcRef"]`
  );
  if (!daiElement) {
    daiElement = subscriberIED.ownerDocument.createElementNS(
      SCL_NAMESPACE,
      'DAI'
    );
    const srcValRef = subscriberIED.querySelector(
      `LN[lnClass="${supervisionType}"]>DOI[name="${supervisionName}"]>DAI[name="setSrcRef"]`
    );
    daiElement.setAttribute('name', 'setSrcRef');

    // transfer valKind and valImport from first supervision instance if present
    if (srcValRef?.hasAttribute('valKind'))
      daiElement.setAttribute('valKind', srcValRef.getAttribute('valKind')!);
    if (srcValRef?.hasAttribute('valImport'))
      daiElement.setAttribute(
        'valImport',
        srcValRef.getAttribute('valImport')!
      );
    edits.push({
      parent: doiElement!,
      reference: null,
      node: daiElement
    });
  }

  const valTextContent = controlBlockReference(controlBlock);
  const valElement = daiElement.querySelector(`Val`);
  let newValElement: Element;

  if (valElement) {
    // remove old element
    edits.push({
      node: valElement
    });
    newValElement = <Element>valElement.cloneNode(true);
  } else {
    newValElement = subscriberIED.ownerDocument.createElementNS(
      SCL_NAMESPACE,
      'Val'
    );
  }
  newValElement.textContent = valTextContent;

  // add new element
  edits.push({
    parent: daiElement!,
    reference: null,
    node: newValElement
  });

  return edits;
}
