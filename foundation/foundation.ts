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
export function minAvailableLogicalNodeInstance(
  lnElements: Element[]
): string | undefined {
  const lnInsts = new Set(lnElements.map(ln => ln.getAttribute('inst') || ''));
  return lnInstRange.find(lnInst => !lnInsts.has(lnInst));
}
