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
  SampledValueControl: 'SMV',
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
    'daName',
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
