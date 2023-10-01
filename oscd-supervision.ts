import {
  css,
  html,
  LitElement,
  nothing,
  PropertyValues,
  TemplateResult,
} from 'lit';
import { msg, str } from '@lit/localize';
import { property, query, state } from 'lit/decorators.js';

import { Edit, newEditEvent, Remove } from '@openscd/open-scd-core';

import '@material/mwc-button';
import '@material/mwc-formfield';
import '@material/mwc-textfield';
import '@material/mwc-list';
import '@material/mwc-list/mwc-list-item';
import '@material/mwc-list/mwc-radio-list-item';
import '@material/mwc-icon-button-toggle';
import '@material/mwc-icon';
import '@material/mwc-icon-button';

import type { ListItem } from '@material/mwc-list/mwc-list-item';
import type { List, SingleSelectedEvent } from '@material/mwc-list';
import type { ListItemBase } from '@material/mwc-list/mwc-list-item-base.js';
import type { TextField } from '@material/mwc-textfield';

import './foundation/components/oscd-filter-button.js';
import './foundation/components/oscd-filtered-list.js';

// import { canInstantiateSubscriptionSupervision } from '@openenergytools/scl-lib';

import {
  compareNames,
  findControlBlocks,
  getDescriptionAttribute,
  getNameAttribute,
} from './foundation/foundation.js';
import {
  gooseActionIcon,
  smvActionIcon,
  gooseIcon,
  smvIcon,
} from './foundation/icons.js';
import { identity } from './foundation/identities/identity.js';
import { selector } from './foundation/identities/selector.js';
import { styles } from './foundation/styles/styles.js';

import {
  controlBlockReference,
  createNewSupervisionLnEvent as createNewSupervisionLnEdit,
  createNewSupervisionLnInst,
  instantiateSubscriptionSupervision,
  isSupervisionModificationAllowed,
  maxSupervisions,
  removeSubscriptionSupervision,
} from './foundation/subscription/subscription.js';

import type { OscdFilteredList } from './foundation/components/oscd-filtered-list.js';
import type { SelectedItemsChangedEvent } from './foundation/components/oscd-filter-button.js';

const controlTag = { GOOSE: 'GSEControl', SMV: 'SampledValueControl' };
const supervisionLnType = { GOOSE: 'LGOS', SMV: 'LSVS' };

function controlBlockDescription(control: Element): {
  pathName: string;
  pathLDeviceAndLN: string;
  pathDescription: string;
} {
  const name = control.getAttribute('name');

  const iedName = control.closest('IED')!.getAttribute('name');
  const lN0 = control.closest('LN0');
  const lDevice = lN0!.closest('LDevice')!;

  const ldInst = lDevice.getAttribute('inst');
  const lnPrefix = lN0!.getAttribute('prefix');
  const lnClass = lN0!.getAttribute('lnClass');
  const lnInst = lN0!.getAttribute('inst');

  const desc = control.getAttribute('desc');
  const lN0Desc = lN0?.getAttribute(' ');

  const descriptions = [desc, lN0Desc].filter(a => !!a).join(' > ');

  const pathName = [iedName, '>', name].filter(a => !!a).join(' ');

  const pathLDeviceAndLN = [ldInst, '/', lnPrefix, lnClass, lnInst]
    .filter(a => !!a)
    .join(' ');

  const pathDescription = descriptions;

  return { pathName, pathLDeviceAndLN, pathDescription };
}

function supervisionPath(supLn: Element): string {
  const ln = supLn.closest('LN, LN0');
  const lDevice = ln!.closest('LDevice')!;

  const ldInst = lDevice.getAttribute('inst');
  const lnPrefix = ln!.getAttribute('prefix');
  const lnClass = ln!.getAttribute('lnClass');
  const lnInst = ln!.getAttribute('inst');

  const path = [ldInst, '/', lnPrefix, lnClass, lnInst]
    .filter(a => !!a)
    .join(' ');

  return path;
}

function getSupervisionCBRef(ln: Element): string | null {
  const type = ln.getAttribute('lnClass') === 'LGOS' ? 'GoCBRef' : 'SvCBRef';

  return (
    ln.querySelector(`DOI[name="${type}"] > DAI[name="setSrcRef"] > Val`)
      ?.textContent ?? null
  );
}

function isGOOSEorSMV(extRef: Element, type: 'GOOSE' | 'SMV'): boolean | null {
  return (
    extRef.getAttribute('serviceType') === type ||
    extRef.getAttribute('pServT') === type
  );
}

function closest(array: number[], target: number): number {
  return array.sort((a, b) => Math.abs(target - a) - Math.abs(target - b))[0];
}

const progressIcons: Record<string, string> = {
  0: 'circle',
  10: 'clock_loader_10',
  20: 'clock_loader_20',
  40: 'clock_loader_40',
  60: 'clock_loader_60',
  80: 'clock_loader_80',
  90: 'clock_loader_90',
  100: 'stroke_full',
};

function getUsageIcon(percent: number): string {
  const closestIconPercent = closest(
    Object.keys(progressIcons).map(i => parseInt(i, 10)),
    percent
  );
  return progressIcons[`${closestIconPercent}`];
}

/**
 * Creates a regular expression to allow case-insensitive searching of list
 * items.
 *
 * * Supports globbing with * and
 * * Supports quoting using both ' and " and is an AND-ing search which
 *   narrows as further search text is added.
 *
 * @param searchExpression
 * @returns a regular expression
 */
function getSearchRegex(searchExpression: string): RegExp {
  if (searchExpression === '') {
    return /.*/i;
  }
  const terms: string[] =
    searchExpression
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .trim()
      .match(/(?:[^\s"']+|['"][^'"]*["'])+/g) ?? [];

  const expandedTerms = terms.map(term =>
    term.replace(/\*/g, '.*').replace(/\?/g, '.{1}').replace(/"|'/g, '')
  );

  const regexString = expandedTerms.map(term => `(?=.*${term})`);

  return new RegExp(`${regexString.join('')}.*`, 'i');
}

/**
 * Ensures callback is not called more frequently than `delay`
 * @param callback - Function to be debounced.
 * @param delay - Duration of debounce in ms.
 */
function debounce(callback: any, delay = 100) {
  let timeout: any;

  return (...args: any) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      callback(...args);
    }, delay);
  };
}

/**
 * Fetches used control block references for a given IED and control type
 * (GOOSE or SMV) and returns them as an array
 * @param ied - SCL IED element.
 * @param type - Either `GOOSE` or `SMV`.
 * @returns an array of control block references.
 */
function getSubscribedCBRefs(
  ied: Element | undefined,
  type: 'GOOSE' | 'SMV'
): string[] {
  if (!ied) return [];
  const extRefs = Array.from(ied.getElementsByTagName('ExtRef')) ?? [];

  const controlBlockRefs: Set<string> = new Set();
  extRefs.forEach(extRef => {
    if (isGOOSEorSMV(extRef, type)) {
      findControlBlocks(extRef, type).forEach(cb =>
        controlBlockRefs.add(controlBlockReference(cb) ?? 'Unknown Control')
      );
    }
  });
  return Array.from(controlBlockRefs);
}

/**
 * Gets GSEControl or SampledValueControl elements for the selected IED.
 *
 * @param controlType either 'GOOSE' or 'SMV'
 * @returns array of GSEControl or SampledValueControl elements
 */

/**
 * Gets GSEControl or SampledValueControl elements _except_ for the
 * selected IED.
 * @param ied - Selected IED SCL element.
 * @param controlType - Either `GOOSE` or `SMV`
 * @returns an array of `GSEControl` or `SampledValueControl` elements.
 */
function getOtherIedControlElements(
  ied: Element | undefined,
  controlType: 'GOOSE' | 'SMV'
): Element[] {
  if (!ied) return [];
  const iedName = getNameAttribute(ied!);
  return Array.from(
    ied.ownerDocument.querySelectorAll(`LN0 > ${controlTag[controlType]}`)
  ).filter(cb => getNameAttribute(cb.closest('IED')!) !== iedName);
}

/**
 * Retrieve supervision LNs for GOOSE or SMV.
 * @param ied - An IED SCL element.
 * @param controlType - Either `GOOSE` or `SMV`.
 * @returns An array of LN elements.
 */
function getSupervisionLNs(
  ied: Element | undefined,
  controlType: 'GOOSE' | 'SMV'
): Element[] {
  if (!ied) return [];

  return Array.from(
    ied.querySelectorAll(`LN[lnClass="${supervisionLnType[controlType]}"]`)
  );
}

/**
 * Retrieve control block references for a given IED whose references is used
 * within a supervision node.
 * @param ied - An SCL IED Element.
 * @param controlType - Either `GOOSE` or `SMV`.
 * @returns An array of control block references.
 */
function getSupervisedCBRefs(
  ied: Element | undefined,
  controlType: 'GOOSE' | 'SMV'
): string[] {
  if (!ied) return [];
  const supervisedCbRefs: string[] = [];
  const controlElements = getOtherIedControlElements(ied, controlType);
  getSupervisionLNs(ied, controlType).forEach(lN => {
    const cbRef = getSupervisionCBRef(lN);
    if (cbRef !== null && cbRef !== '') {
      const controlElement =
        controlElements.find(
          control => cbRef === controlBlockReference(control)
        ) ?? null;
      if (controlElement) {
        if (!supervisedCbRefs.includes(cbRef)) supervisedCbRefs.push(cbRef);
      }
    }
  });
  return supervisedCbRefs;
}

/**
 * Get control block references for an IED and a
 * specific control type
 * @param ied - An SCL IED element.
 * @param controlType - Either `GOOSE` or `SMV`.
 * @returns An array of control block references.
 */
function getCBRefs(
  ied: Element | undefined,
  controlType: 'GOOSE' | 'SMV'
): string[] {
  return getOtherIedControlElements(ied, controlType).map(
    cb => controlBlockReference(cb) ?? 'Unknown Control'
  );
}

/**
 * Editor to allow allocation of GOOSE and SMV supervision LNs
 * to control blocks
 */
export default class Supervision extends LitElement {
  @property({ attribute: false })
  doc!: XMLDocument;

  @property() docName!: string;

  @property() editCount = -1;

  @property() controlType: 'GOOSE' | 'SMV' = 'GOOSE';

  @state()
  private get iedList(): Element[] {
    return this.doc
      ? Array.from(this.doc.querySelectorAll(':root > IED')).sort((a, b) =>
          compareNames(a, b)
        )
      : [];
  }

  @state()
  selectedIEDs: string[] = [];

  /**
   * Control block references for non-selected IEDs
   */
  @state()
  otherIedsCBRefs: Array<string> = [];

  /**
   * Control block references for which selected IED
   * has a subscription in an `ExtRef` element
   */
  @state()
  selectedIedSubscribedCBRefs: Array<string> = [];

  /**
   * Control block references for which the selected IED
   * has an supervision LN referenced to
   */
  @state()
  selectedIedSupervisedCBRefs: Array<string> = [];

  @property({ type: String })
  searchUnusedSupervisions: RegExp = /.*/i;

  @state()
  private get selectedIed(): Element | undefined {
    // When there is no IED selected, or the selected IED has no parent
    // (IED has been removed) select the first IED from the list
    if (this.selectedIEDs.length >= 1) {
      return this.iedList.find(element => {
        const iedName = getNameAttribute(element);
        return this.selectedIEDs[0] === iedName;
      });
    }
    return undefined;
  }

  @state()
  selectedControl: Element | null = null;

  @state()
  selectedSupervision: Element | null = null;

  @state()
  newSupervision = false;

  @query('#unusedControls')
  selectedUnusedControlsListUI!: List;

  @query('#unusedSupervisions')
  selectedUnusedSupervisionsListUI!: List;

  @query('#unusedControls mwc-list-item[selected]')
  selectedUnusedControlUI?: ListItem;

  @query('#unusedSupervisions mwc-list-item[selected]')
  selectedUnusedSupervisionUI?: ListItem;

  @query('#filterUnusedSupervisionInput')
  filterUnusedSupervisionInputUI?: TextField;

  @query('#unusedControls')
  filterUnusedControlBlocksList?: HTMLElement;

  /**
   * Update stores of control block references which have (from this IED)
   * supervisions or subscriptions or belong to other IEDs
   */
  protected updateCBRefInfo(
    ied: Element | undefined,
    controlType: 'GOOSE' | 'SMV'
  ) {
    this.otherIedsCBRefs = getCBRefs(ied, controlType);
    this.selectedIedSubscribedCBRefs = getSubscribedCBRefs(ied, controlType);
    this.selectedIedSupervisedCBRefs = getSupervisedCBRefs(ied, controlType);
  }

  protected firstUpdated(): void {
    this.updateCBRefInfo(this.selectedIed, this.controlType);
  }

  protected updated(_changedProperties: PropertyValues): void {
    super.updated(_changedProperties);

    // When the document is updated, we reset the selected IED.
    // TODO: Detect same document opened twice.
    if (_changedProperties.has('doc')) {
      this.selectedIEDs = [];

      if (this.iedList.length > 0) {
        const iedName = getNameAttribute(this.iedList[0]);
        if (iedName) {
          this.selectedIEDs = [iedName];
          this.updateCBRefInfo(this.selectedIed, this.controlType);
        }
      }
    }

    if (_changedProperties.has('selectedIed') && this.selectedIed) {
      this.updateCBRefInfo(this.selectedIed, this.controlType);
      this.clearListSelections();
      this.resetSearchFilters();
    }

    if (_changedProperties.has('editCount') && _changedProperties.size === 1) {
      // when change is introduced through undo and redo need to update cached
      // variables and reset any in-progress user action
      this.updateCBRefInfo(this.selectedIed, this.controlType);
      this.clearListSelections();
    }
  }

  // eslint-disable-next-line class-methods-use-this
  renderUnusedSupervisionNode(lN: Element): TemplateResult {
    const description = getDescriptionAttribute(lN);
    const controlBlockRef = getSupervisionCBRef(lN);
    const invalidControlBlock =
      controlBlockRef !== '' &&
      !this.otherIedsCBRefs.includes(
        controlBlockRef ?? 'Unknown control block'
      ) &&
      controlBlockRef !== null;
    return html`
      <mwc-list-item
        ?twoline=${!!description || !!invalidControlBlock}
        class="mitem"
        graphic="icon"
        ?hasMeta=${invalidControlBlock}
        ?noninteractive=${this.selectedIedSupervisedCBRefs.length ===
        this.selectedIedSubscribedCBRefs.length}
        data-supervision="${identity(lN)}"
        value="${identity(lN)}"
      >
        <span>${supervisionPath(lN)}</span>
        ${description || invalidControlBlock
          ? html`<span slot="secondary"
              >${description}${description && invalidControlBlock
                ? ' - '
                : ''}${invalidControlBlock
                ? `Invalid Control Block reference: "${controlBlockRef}"`
                : ''}</span
            >`
          : nothing}
        <mwc-icon slot="graphic">monitor_heart</mwc-icon>
        ${invalidControlBlock
          ? html`<mwc-icon class="invalid-mapping" slot="meta"
              >warning</mwc-icon
            >`
          : ''}
      </mwc-list-item>
      <!-- TODO: Tidy up invalid control block reference code -->
      <!-- TODO: In future add wizards -->
    `;
  }

  // eslint-disable-next-line class-methods-use-this
  renderSupervisionListItem(lN: Element, interactive: boolean): TemplateResult {
    const description = getDescriptionAttribute(lN);
    return html`
      <mwc-list-item
        ?twoline=${!!description}
        ?noninteractive=${!interactive}
        class="sup-ln mitem"
        graphic="icon"
        data-ln="${identity(lN)}"
        value="${identity(lN)}"
      >
        <span>${supervisionPath(lN)}</span>
        ${description
          ? html`<span slot="secondary">${description}</span>`
          : nothing}
        <mwc-icon slot="graphic">monitor_heart</mwc-icon>
      </mwc-list-item>
      <!-- TODO: In future add with wizards 
      <mwc-icon-button
        class="sup-btn"
        icon="edit"
      ></mwc-icon-button> -->
    `;
  }

  clearListSelections(): void {
    this.selectedControl = null;
    this.selectedSupervision = null;
    this.newSupervision = false;

    if (this.selectedUnusedControlUI) {
      this.selectedUnusedControlUI!.selected = false;
      this.selectedUnusedControlUI!.activated = false;
    }

    if (this.selectedUnusedSupervisionUI) {
      this.selectedUnusedSupervisionUI!.selected = false;
      this.selectedUnusedSupervisionUI!.activated = false;
    }
  }

  private getSelectedIedSupLNs(
    used: boolean = true,
    unused: boolean = false
  ): Element[] {
    return getSupervisionLNs(this.selectedIed, this.controlType)
      .filter(lN => {
        const cbRef = getSupervisionCBRef(lN);
        const cbRefUsed = this.selectedIedSubscribedCBRefs.includes(
          cbRef ?? 'Unknown Control'
        );
        return (cbRefUsed && used) || (!cbRefUsed && unused);
      })
      .sort((lnA: Element, lnB: Element): number => {
        // ensure stable sort order based on object path and instance number
        const instA = `${identity(lnA.parentElement)} ${lnA
          .getAttribute('inst')!
          .padStart(5, '0')}`;
        const instB = `${identity(lnB.parentElement)} ${lnB
          .getAttribute('inst')!
          .padStart(5, '0')}`;
        return instA.localeCompare(instB);
      });
  }

  protected renderUnusedSupervisionLNs(
    used = false,
    unused = false
  ): TemplateResult {
    if (!this.selectedIed) return html``;

    const maxSupervisionLNs = this.selectedIed
      ? maxSupervisions(this.selectedIed, controlTag[this.controlType])
      : 0;

    const instantiatedSupervisionLNs = getSupervisionLNs(
      this.selectedIed,
      this.controlType
    ).length;

    const availableSupervisionLNs =
      maxSupervisionLNs - instantiatedSupervisionLNs;

    const supervisionType = this.controlType === 'GOOSE' ? 'LGOS' : 'LSVS';

    return html`${this.getSelectedIedSupLNs(used, unused)
        .filter(supervision => {
          const supervisionSearchText = `${identity(
            supervision
          )} ${supervision.getAttribute('desc')}`;

          return (
            this.searchUnusedSupervisions &&
            this.searchUnusedSupervisions.test(supervisionSearchText)
          );
        })
        .map(lN => html`${this.renderUnusedSupervisionNode(lN)}`)}
      <mwc-list-item
        hasMeta
        class="sup-ln mitem"
        graphic="icon"
        data-supervision="NEW"
        value="${msg('New')} ${supervisionType} ${msg('Supervision')}"
        ?noninteractive=${availableSupervisionLNs === 0 ||
        this.selectedIedSupervisedCBRefs.length ===
          this.selectedIedSubscribedCBRefs.length}
      >
        <span
          >${msg('New')} ${supervisionType} ${msg('Supervision')}
          ${instantiatedSupervisionLNs > 0
            ? html`— ${availableSupervisionLNs} ${msg('available')}</span>
                </div>`
            : nothing}
        </span>
        <mwc-icon slot="graphic">heart_plus</mwc-icon>
      </mwc-list-item>`;
  }

  private renderDeleteIcons(
    used: boolean = true,
    unused: boolean = false,
    withFiltering: boolean = false
  ): TemplateResult {
    const firstSupervision = getSupervisionLNs(
      this.selectedIed,
      this.controlType
    )[0];
    return html`<mwc-list class="column mlist deleter">
      <!-- show additional item to allow delete button alignment -->
      ${unused
        ? html`<mwc-list-item twoline noninteractive></mwc-list-item>`
        : nothing}
      ${this.getSelectedIedSupLNs(used, unused)
        .filter(supervision => {
          const supervisionSearchText = `${identity(
            supervision
          )} ${supervision.getAttribute('desc')}`;

          return (
            !withFiltering ||
            (withFiltering &&
              this.searchUnusedSupervisions &&
              this.searchUnusedSupervisions.test(supervisionSearchText))
          );
        })
        .map(
          lN => html`
            <mwc-list-item
              ?noninteractive=${!isSupervisionModificationAllowed(
                this.selectedIed!,
                supervisionLnType[this.controlType]
              )}
              twoline
              graphic="icon"
              data-ln="${identity(lN)}"
              value="${identity(lN)}"
              title="${lN === firstSupervision
                ? `${msg('First supervision logical node cannot be removed')}`
                : ''}"
            >
              <mwc-icon
                class="column button mitem ${lN !== firstSupervision
                  ? 'deletable'
                  : ''}"
                slot="graphic"
                label="${msg('Delete supervision logical node')}"
                data-lN="${identity(lN)}"
                @click=${() => {
                  if (
                    isSupervisionModificationAllowed(
                      this.selectedIed!,
                      supervisionLnType[this.controlType]
                    ) &&
                    lN !== firstSupervision
                  ) {
                    const removeEdit: Remove = {
                      node: lN,
                    };
                    this.dispatchEvent(newEditEvent(removeEdit));
                    this.selectedIedSupervisedCBRefs = getSupervisedCBRefs(
                      this.selectedIed,
                      this.controlType
                    );
                  }

                  this.clearListSelections();
                }}
                >${lN === firstSupervision ? 'block' : 'delete'}</mwc-icon
              >
            </mwc-list-item>
          `
        )}
      <!-- show additional item to allow delete button alignment -->
      ${unused
        ? html`<mwc-list-item twoline noninteractive></mwc-list-item>`
        : nothing}
    </mwc-list>`;
  }

  private renderUsedSupervisionLNs(
    onlyUsed = false,
    onlyUnused = false
  ): TemplateResult {
    if (!this.selectedIed) return html``;

    const usedSupervisions = getSupervisionLNs(
      this.selectedIed,
      this.controlType
    ).filter(lN => {
      const cbRef = getSupervisionCBRef(lN);
      const cbRefUsed = this.otherIedsCBRefs.includes(
        cbRef ?? 'Unknown Control'
      );
      return (cbRefUsed && onlyUsed) || (!cbRefUsed && onlyUnused);
    });

    if (usedSupervisions.length === 0)
      return html`<h3>${msg('No supervision nodes used')}</h3>`;

    return html`<mwc-list class="column mlist">
      ${usedSupervisions.map(
        lN => html`${this.renderSupervisionListItem(lN, onlyUnused)}`
      )}
    </mwc-list>`;
  }

  private renderUsedSupervisionRemovalIcons(): TemplateResult {
    return html`<mwc-list class="column remover mlist">
      ${this.getSelectedIedSupLNs(true, false).map(
        lN => html`
          <mwc-list-item
            ?noninteractive=${!isSupervisionModificationAllowed(
              this.selectedIed!,
              supervisionLnType[this.controlType]
            )}
            graphic="icon"
            twoline
            data-ln="${identity(lN)}"
            value="${identity(lN)}"
            @click=${() => {
              const cbRef = getSupervisionCBRef(lN);
              const controlBlock =
                getOtherIedControlElements(
                  this.selectedIed,
                  this.controlType
                ).find(control => cbRef === controlBlockReference(control)) ??
                null;
              if (controlBlock) {
                const removeEdit = removeSubscriptionSupervision(
                  controlBlock,
                  this.selectedIed
                );

                this.dispatchEvent(newEditEvent(removeEdit));
                this.selectedIedSupervisedCBRefs = getSupervisedCBRefs(
                  this.selectedIed,
                  this.controlType
                );
                this.requestUpdate();
              }

              this.clearListSelections();
            }}
          >
            <mwc-icon
              slot="graphic"
              title="${msg('Remove supervision of this control block')}"
              class="column button mitem deletable"
              >heart_minus</mwc-icon
            >
          </mwc-list-item>
        `
      )}
    </mwc-list>`;
  }

  private renderControl(
    controlElement: Element,
    unused: boolean = false
  ): TemplateResult {
    if (!controlElement) return html``;

    const { pathName, pathLDeviceAndLN, pathDescription } =
      controlBlockDescription(controlElement);
    const datasetName = controlElement.getAttribute('datSet');

    const controlId =
      controlElement.tagName === 'GSEControl'
        ? controlElement.getAttribute('appID')
        : controlElement.getAttribute('smvID');

    let secondLineDesc = pathLDeviceAndLN;

    if (pathDescription && !datasetName) {
      secondLineDesc += ` - ${pathDescription} (Id: ${controlId})}`;
    } else if (pathDescription && datasetName) {
      secondLineDesc += ` - ${pathDescription} (Dataset: ${datasetName}, Id: ${controlId})`;
    } else if (!pathDescription && datasetName) {
      secondLineDesc += ` - Dataset: ${datasetName}, Id: ${controlId})`;
    }

    return html`<mwc-list-item
      ?noninteractive=${!unused &&
      !this.selectedSupervision &&
      !this.newSupervision}
      graphic="icon"
      ?twoline=${!!pathDescription || !!datasetName}
      data-control="${identity(controlElement)}"
      value="${pathName}"
    >
      <span>${pathName}</span>
      <span slot="secondary">${secondLineDesc} </span>
      <mwc-icon slot="graphic"
        >${this.controlType === 'GOOSE' ? gooseIcon : smvIcon}</mwc-icon
      >
    </mwc-list-item>`;
  }

  private renderUnusedControls(): TemplateResult {
    if (!this.selectedIed) return html``;
    return html`${getOtherIedControlElements(this.selectedIed, this.controlType)
      .filter(
        control =>
          this.selectedIedSubscribedCBRefs.includes(
            controlBlockReference(control) ?? 'Unknown Control'
          ) &&
          !this.selectedIedSupervisedCBRefs.includes(
            controlBlockReference(control) ?? 'Unknown Control'
          )
      )
      .map(
        controlElement => html`${this.renderControl(controlElement, true)}`
      )}`;
  }

  private renderUsedControls(): TemplateResult {
    if (!this.selectedIed) return html``;

    return html`<mwc-list class="column mlist">
      ${this.getSelectedIedSupLNs(true, false).map(lN => {
        const cbRef = getSupervisionCBRef(lN);

        const controlElement =
          getOtherIedControlElements(this.selectedIed, this.controlType).find(
            control => cbRef === controlBlockReference(control)
          ) ?? null;

        return html`${controlElement
          ? this.renderControl(controlElement)
          : nothing}`;
      })}</mwc-list
    >`;
  }

  private renderInfo(): TemplateResult {
    const supervisionType = this.controlType === 'GOOSE' ? 'LGOS' : 'LSVS';

    return html`<div class="side-icons">
      ${this.selectedIed &&
      !isSupervisionModificationAllowed(
        this.selectedIed,
        supervisionLnType[this.controlType]
      )
        ? html`<mwc-icon-button
            title="${msg(str`
              This IED does not support ${supervisionType} supervision modification.`)}"
            icon="warning"
          ></mwc-icon-button>`
        : nothing}
    </div>`;
  }

  private renderIedSelector(): TemplateResult {
    return html`<div id="iedSelector">
      <oscd-filter-button
        id="iedFilter"
        icon="developer_board"
        header="IED Selector"
        @selected-items-changed="${(e: SelectedItemsChangedEvent) => {
          this.selectedIEDs = e.detail.selectedItems;
          // reset control selection
          this.selectedControl = null;
          this.resetSearchFilters();
          this.requestUpdate('selectedIed');
        }}"
      >
        ${this.iedList.map(ied => {
          const name = getNameAttribute(ied) ?? 'Unknown Name';
          const descr = getDescriptionAttribute(ied);
          const type = ied.getAttribute('type');
          const manufacturer = ied.getAttribute('manufacturer');
          return html` <mwc-radio-list-item
            value="${name}"
            ?twoline="${!!(type && manufacturer)}"
            ?selected="${this.selectedIEDs?.includes(name ?? '')}"
          >
            ${name} ${descr ? html` (${descr})` : html``}
            <span slot="secondary">
              ${type} ${type && manufacturer ? html`&mdash;` : nothing}
              ${manufacturer}
            </span>
          </mwc-radio-list-item>`;
        })}
      </oscd-filter-button>
      <h2>
        ${this.selectedIed
          ? getNameAttribute(this.selectedIed)
          : msg('No IED Selected')}
        (${this.selectedIed?.getAttribute('type') ?? 'Unknown Type'})
      </h2>
    </div>`;
  }

  private resetSearchFilters() {
    if (this.filterUnusedSupervisionInputUI) {
      this.filterUnusedSupervisionInputUI.value = '';
      this.searchUnusedSupervisions = /.*/i;
    }

    if (this.filterUnusedControlBlocksList) {
      this.filterUnusedControlBlocksList!.shadowRoot!.querySelector(
        'mwc-textfield'
      )!.value = '';
    }
  }

  private createSupervision(
    selectedControl: Element,
    selectedSupervision: Element | null,
    newSupervision: boolean
  ): void {
    let edits: Edit[] | undefined;

    if (newSupervision) {
      this.createNewSupervision(selectedControl);
    } else {
      edits = instantiateSubscriptionSupervision(
        selectedControl,
        this.selectedIed,
        selectedSupervision ?? undefined
      );
      this.dispatchEvent(newEditEvent(edits));
    }

    this.selectedIedSupervisedCBRefs = getSupervisedCBRefs(
      this.selectedIed,
      this.controlType
    );
  }

  // TODO: restructure in terms of edits
  private createNewSupervision(selectedControl: Element): void {
    const subscriberIED = this.selectedIed!;
    const supervisionType =
      selectedControl?.tagName === 'GSEControl' ? 'LGOS' : 'LSVS';
    const newLN = createNewSupervisionLnInst(subscriberIED, supervisionType);
    let edits: Edit[];

    const parent = subscriberIED.querySelector(
      `LN[lnClass="${supervisionType}"]`
    )?.parentElement;
    if (parent && newLN) {
      // use Insert edit for supervision LN
      edits = [
        {
          parent,
          node: newLN,
          reference:
            parent!.querySelector(`LN[lnClass="${supervisionType}"]:last-child`)
              ?.nextElementSibling ?? null,
        },
      ];

      const instanceNum = newLN?.getAttribute('inst');

      // TODO: Explain To The User That They Have Erred And Can't Make Any New Subscriptions!
      if (edits) {
        this.dispatchEvent(newEditEvent(edits));
        const instantiationEdit = instantiateSubscriptionSupervision(
          selectedControl,
          this.selectedIed,
          parent!.querySelector(
            `LN[lnClass="${supervisionType}"][inst="${instanceNum}"]`
          )!
        );
        this.dispatchEvent(newEditEvent(instantiationEdit));
      }
    }
  }

  private renderUnusedControlList(): TemplateResult {
    return html`<oscd-filtered-list
      id="unusedControls"
      @selected=${(ev: SingleSelectedEvent) => {
        const selectedListItem = (<ListItemBase>(
          (<OscdFilteredList>ev.target).selected
        ))!;
        if (!selectedListItem) return;
        const { control } = selectedListItem.dataset;
        const selectedControl = <Element>(
          this.doc.querySelector(
            selector(controlTag[this.controlType], control ?? 'Unknown')
          )
        );

        this.selectedControl = selectedControl;

        if (
          this.selectedControl &&
          (this.selectedSupervision || this.newSupervision)
        ) {
          this.createSupervision(
            this.selectedControl,
            this.selectedSupervision,
            this.newSupervision
          );
        }

        this.clearListSelections();
      }}
    >
      ${this.renderUnusedControls()}
    </oscd-filtered-list>`;
  }

  private renderUnusedSupervisionList(): TemplateResult {
    return html`<div class="filteredList">
      <div class="searchField mitem sup-ln">
        <abbr title="${msg('Search')}"
          ><mwc-textfield
            id="filterUnusedSupervisionInput"
            iconTrailing="search"
            outlined
            @input=${debounce(() => {
              this.searchUnusedSupervisions = getSearchRegex(
                this.filterUnusedSupervisionInputUI!.value
              );
            })}
          ></mwc-textfield
        ></abbr>
      </div>
      <mwc-list
        id="unusedSupervisions"
        activatable
        ?noninteractive=${this.selectedIedSupervisedCBRefs.length ===
        this.selectedIedSubscribedCBRefs.length}
        @selected=${(ev: SingleSelectedEvent) => {
          const selectedListItem = (<ListItemBase>(
            (<OscdFilteredList>ev.target).selected
          ))!;
          if (!selectedListItem) return;

          const { supervision } = selectedListItem.dataset;
          const selectedSupervision = <Element>(
            this.doc.querySelector(selector('LN', supervision ?? 'Unknown'))
          );
          if (supervision === 'NEW') {
            this.newSupervision = true;
          }

          this.selectedSupervision = selectedSupervision;
          this.selectedControl = null;
        }}
      >
        ${this.renderUnusedSupervisionLNs(false, true)}
      </mwc-list>
    </div>`;
  }

  renderUnusedControlBlocksAndSupervisions(): TemplateResult {
    const maxSupervisionLNs = this.selectedIed
      ? maxSupervisions(this.selectedIed, controlTag[this.controlType])
      : 0;

    const instantiatedSupervisionLNs = getSupervisionLNs(
      this.selectedIed,
      this.controlType
    ).length;

    const availableSupervisionLNs =
      maxSupervisionLNs - instantiatedSupervisionLNs;

    let titleText;

    if (this.selectedSupervision) {
      titleText = supervisionPath(this.selectedSupervision) ?? '';
    }

    if (this.newSupervision) {
      titleText = msg('New Supervision LN');
    }

    const supervisionType = this.controlType === 'GOOSE' ? 'LGOS' : 'LSVS';

    return html`<section class="unused">
      <div class="column-unused">
        <h2>
          <span
            class="${this.selectedSupervision || this.newSupervision
              ? 'selected'
              : ''}"
          >
            ${this.selectedSupervision || this.newSupervision
              ? titleText
              : msg(
                  str`Available ${
                    this.controlType === 'GOOSE' ? 'LGOS' : 'LSVS'
                  } Supervisions`
                )}
          </span>
          <mwc-icon-button
            id="createNewLN"
            class="greyOutDisabled"
            title="${msg(str`
              Create New ${supervisionType} Supervision`)} - ${availableSupervisionLNs} ${msg(
              'available'
            )}"
            icon="heart_plus"
            ?disabled=${availableSupervisionLNs <= 0}
            @click=${() => {
              if (this.selectedIed) {
                const edit = createNewSupervisionLnEdit(
                  this.selectedIed,
                  supervisionType
                );

                if (edit) this.dispatchEvent(newEditEvent(edit));

                // TODO: Why is editCount not sufficient to re-render?
                this.requestUpdate();
              }
            }}
          ></mwc-icon-button>
        </h2>
        <div class="available-grouper">
          ${this.renderUnusedSupervisionList()}
          ${this.renderDeleteIcons(false, true, true)}
        </div>
      </div>
      <hr />
      <div class="column-unused">
        <h2
          class="${this.selectedSupervision || this.newSupervision
            ? 'selected title-element text'
            : ''}"
        >
          ${this.controlType === 'GOOSE'
            ? msg(`Select GOOSE Control Block`)
            : msg(`Select SV Control Block`)}
        </h2>
        ${this.renderUnusedControlList()}
      </div>
    </section>`;
  }

  renderControlSelector(): TemplateResult {
    return html`<mwc-icon-button-toggle
      id="controlType"
      label="${msg('Change between GOOSE and Sampled Value publishers')}"
      @click=${() => {
        if (this.controlType === 'GOOSE') {
          this.controlType = 'SMV';
        } else {
          this.controlType = 'GOOSE';
        }

        this.updateCBRefInfo(this.selectedIed, this.controlType);
        this.clearListSelections();
        this.resetSearchFilters();
      }}
      >${gooseActionIcon}${smvActionIcon}
    </mwc-icon-button-toggle>`;
  }

  protected render(): TemplateResult {
    if (!this.doc) return html``;

    if (this.iedList.length === 0) return html`<h1>>No IEDs present</h1>`;

    const usedSupLNs = this.getSelectedIedSupLNs(true, false).length;
    const totalSupLNs = this.getSelectedIedSupLNs(true, true).length;
    const percentUsed = (usedSupLNs / totalSupLNs) * 100;

    return html`<div id="container">
      <div id="controlSection">
        ${this.renderIedSelector()} ${this.renderInfo()}
      </div>
      <div id="scrollableArea">
        <section>
          <div id="controlSelector" class="column">
            ${this.renderControlSelector()}
            <h2>
              ${msg(
                str`${
                  this.controlType === 'GOOSE' ? 'LGOS' : 'LSVS'
                } Supervisions`
              )}
            </h2>
            <div class="side-icons">
              <div class="usage-group">
                <mwc-icon>${getUsageIcon(percentUsed)}</mwc-icon>
                <span class="usage"
                  >${usedSupLNs} / ${totalSupLNs} ${msg('used')}</span
                >
              </div>
            </div>
          </div>
          <div class="column deleter"></div>
          <div class="column remover"></div>
          <h2 id="cbTitle" class="column">
            ${this.controlType === 'GOOSE'
              ? msg('GOOSE Control Blocks')
              : msg('SV Control Blocks')}
          </h2>
          ${this.renderUsedSupervisionLNs(true, false)}
          ${this.renderDeleteIcons(true, false)}
          ${this.renderUsedSupervisionRemovalIcons()}
          ${this.renderUsedControls()}
        </section>
        ${this.selectedIed &&
        isSupervisionModificationAllowed(
          this.selectedIed,
          supervisionLnType[this.controlType]
        )
          ? html`${this.renderUnusedControlBlocksAndSupervisions()}`
          : nothing}
      </div>
    </div>`;
  }

  static styles = css`
    ${styles}

    :host {
      --disabledVisibleElement: rgba(0, 0, 0, 0.38);
      --scrollbarBG: var(--mdc-theme-background, #cfcfcf00);
      --thumbBG: var(--mdc-button-disabled-ink-color, #996cd8cc);
    }

    #container {
      width: 100%;
      height: 100%;
      display: block;
      overflow: hidden;
      height: calc(100vh - 112px);
    }

    #scrollableArea {
      overflow-y: scroll;
      height: calc(100vh - 200px);
      scrollbar-width: auto;
      scrollbar-color: var(--thumbBG) var(--scrollbarBG);
    }

    #scrollableArea::-webkit-scrollbar {
      width: 6px;
    }

    #scrollableArea::-webkit-scrollbar-track {
      background: var(--scrollbarBG);
    }

    #scrollableArea::-webkit-scrollbar-thumb {
      background: var(--thumbBG);
      border-radius: 6px;
    }

    @media (max-width: 700px) {
      #container {
        height: calc(100vh - 110px);
      }
    }

    h1,
    h2,
    h3,
    .usage {
      color: var(--mdc-theme-on-surface);
      font-family: 'Roboto', sans-serif;
      font-weight: 300;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      margin: 0px;
      line-height: 48px;
      padding-left: 0.3em;
      transition: background-color 150ms linear;
    }

    .usage {
      font-size: 16px;
      display: inline-flex;
    }

    h2.selected,
    h2 .selected {
      font-weight: 400;
      color: var(--mdc-theme-primary, #6200ee);
    }

    #cbTitle,
    #controlSelector,
    #controlSelector > mwc-formfield,
    #iedSelector {
      display: flex;
      flex-direction: row;
      justify-content: flex-start;
    }

    #controlSection {
      display: flex;
      justify-content: space-between;
      padding: 20px;
      align-items: center;
    }

    section {
      display: flex;
      flex-wrap: wrap;
      column-gap: 20px;
      padding: 10px 20px 0px 20px;
    }

    section.unused {
      flex-wrap: nowrap;
    }

    #supervisionItems {
      display: flex;
      flex-direction: row;
    }

    .sup-btn {
      /* TODO: Discuss with Christian - actually need a theme in OpenSCD core! */
      --mdc-theme-text-disabled-on-light: LightGray;
      max-width: 50px;
    }

    .sup-ln {
      justify-content: flex-start;
      width: 100%;
    }

    #iedFilter,
    #controlType {
      --mdc-icon-size: 32px;
    }

    #iedFilter {
      color: var(--mdc-theme-secondary, #018786);
    }

    #controlType > svg {
      border-radius: 24px;
      background-color: var(--mdc-theme-secondary, #018786);
      color: var(--mdc-theme-on-secondary, white);
    }

    .button {
      --mdc-icon-size: 32px;
      color: var(--mdc-theme-secondary, #018786);
      padding-right: 5px;
    }

    /* TODO: Match theme colours, but how? */
    .greyOutDisabled {
      --mdc-theme-text-disabled-on-light: var(--disabledVisibleElement);
    }

    .sup-ln.mitem[data-supervision='NEW'][noninteractive] {
      color: var(--disabledVisibleElement);
    }

    .item-grouper {
      display: flex;
      align-items: center;
    }

    .remover,
    .deleter {
      max-width: 50px;
    }

    .mitem {
      height: 72px;
    }

    .mitem.button {
      justify-content: space-around;
    }

    .deletable:hover {
      color: var(--mdc-theme-error, red);
    }

    .usage-group {
      display: flex;
      align-items: center;
      padding-left: 10px;
    }

    .side-icons {
      display: flex;
    }

    mwc-list-item[noninteractive] {
      font-weight: 400;
    }

    .column {
      display: flex;
      /* A little hacky - the fixed width columns will allow the others to grow */
      flex: 1 1 40%;
      flex-direction: column;
      justify-content: space-between;
    }

    .column-unused {
      display: flex;
      flex: 1 1 48%;
      flex-direction: column;
    }

    #createNewLN {
      float: right;
    }

    .available-grouper {
      display: flex;
      justify-content: space-between;
    }

    #unusedSupervisions {
      width: 100%;
    }

    .invalid-mapping {
      color: var(--mdc-theme-error, red);
    }

    .searchField {
      display: flex;
      flex: auto;
    }

    .searchField abbr {
      display: flex;
      flex: auto;
      margin: 8px;
      text-decoration: none;
      border-bottom: none;
    }

    .searchField mwc-textfield {
      width: 100%;
      --mdc-shape-small: 28px;
    }

    .filteredList {
      width: 100%;
    }
  `;
}
