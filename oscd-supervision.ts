import { msg } from '@lit/localize';
import {
  css,
  html,
  LitElement,
  nothing,
  PropertyValues,
  svg,
  TemplateResult,
} from 'lit';
import { ifDefined } from 'lit/directives/if-defined.js';

// import { msg } from '@lit/localize';
import { property, state } from 'lit/decorators.js';

import '@material/mwc-button';
import '@material/mwc-formfield';
import '@material/mwc-textfield';
import '@material/mwc-list';
import '@material/mwc-list/mwc-list-item';
import '@material/mwc-list/mwc-radio-list-item';
import '@material/mwc-icon-button-toggle';
import '@material/mwc-icon';
import '@material/mwc-icon-button';

import './foundation/components/oscd-filtered-list.js';

import { styles } from './foundation/styles/styles.js';
import {
  compareNames,
  getDescriptionAttribute,
  getNameAttribute,
} from './foundation/foundation.js';

import './foundation/components/oscd-filter-button.js';

import type { SelectedItemsChangedEvent } from './foundation/components/oscd-filter-button.js';
import { identity } from './foundation/identities/identity.js';

const controlTag = { GOOSE: 'GSEControl', SV: 'SampledValueControl' };
const supervisionLnType = { GOOSE: 'LGOS', SV: 'LSVS' };
const supervisionCBRef = { GOOSE: 'GoCBRef', SV: 'SvCBRef' };

const pathsSVG = {
  gooseIcon: svg`<path fill="currentColor" d="M11,7H15V9H11V15H13V11H15V15A2,2 0 0,1 13,17H11A2,2 0 0,1 9,15V9A2,2 0 0,1 11,7M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4Z" />`,
  lNIcon: svg`<path stroke="currentColor" stroke-width="1.89" fill="none" d="m4.2 0.945h18.1c1.8 0 3.25 1.45 3.25 3.25v11.6c0 1.8-1.45 3.25-3.25 3.25h-18.1c-1.8 0-3.25-1.45-3.25-3.25v-11.6c0-1.8 1.45-3.25 3.25-3.25z"/><path fill="currentColor" d="m5.71 15v-10h1.75v8.39h4.47v1.62z"/><path fill="currentColor" d="m18.2 15-3.63-7.71q0.107 1.12 0.107 1.8v5.9h-1.55v-10h1.99l3.69 7.77q-0.107-1.07-0.107-1.95v-5.82h1.55v10z"/>`,
  smvIcon: svg`<path fill="currentColor" d="M11,7H15V9H11V11H13A2,2 0 0,1 15,13V15A2,2 0 0,1 13,17H9V15H13V13H11A2,2 0 0,1 9,11V9A2,2 0 0,1 11,7M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4Z" />`,
};

const gooseIcon = svg`<svg style="width:24px;height:24px" viewBox="0 0 24 24">${pathsSVG.gooseIcon}</svg>`;
const lNIcon = svg`<svg style="width:24px;height:24px" viewBox="0 0 24 24">${pathsSVG.lNIcon}</svg>`;
const smvIcon = svg`<svg style="width:24px;height:24px" viewBox="0 0 24 24">${pathsSVG.smvIcon}</svg>`;

const gooseActionIcon = svg`<svg slot="offIcon" style="width:24px;height:24px" viewBox="0 0 24 24">${pathsSVG.gooseIcon}</svg>`;
const smvActionIcon = svg`<svg slot="onIcon" style="width:24px;height:24px" viewBox="0 0 24 24">${pathsSVG.smvIcon}</svg>`;

function removeIedPart(identityString: string | number): string {
  return `${identityString}`.split('>').slice(1).join('>').trim().slice(1);
}

function getSupervisionControlBlockRef(
  ln: Element,
  type: 'GOOSE' | 'SV'
): string | null {
  return (
    ln.querySelector(
      `DOI[name="${supervisionCBRef[type]}"] > DAI[name="setSrcRef"] > Val`
    )?.textContent ?? null
  );
}

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

const serviceTypeControlBlockTags: Partial<Record<string, string[]>> = {
  GOOSE: ['GSEControl'],
  SMV: ['SampledValueControl'],
  Report: ['ReportControl'],
  NONE: ['LogControl', 'GSEControl', 'SampledValueControl', 'ReportControl'],
};

/**
 * Check if the ExtRef is already subscribed to a FCDA Element.
 *
 * @param extRefElement - The Ext Ref Element to check.
 */
export function isSubscribed(extRefElement: Element): boolean {
  return (
    extRefElement.hasAttribute('iedName') &&
    extRefElement.hasAttribute('ldInst') &&
    extRefElement.hasAttribute('prefix') &&
    extRefElement.hasAttribute('lnClass') &&
    extRefElement.hasAttribute('lnInst') &&
    extRefElement.hasAttribute('doName') &&
    extRefElement.hasAttribute('daName')
  );
}

// NOTE: This function modified from the core function to more efficiently handle the srcXXX
export function findControlBlocks(
  extRef: Element,
  controlType: 'GOOSE' | 'SV'
): Element[] {
  if (!isSubscribed(extRef)) return [];

  const extRefValues = ['iedName', 'srcPrefix', 'srcCBName', 'srcLNInst'];
  const [srcIedName, srcPrefix, srcCBName, srcLNInst] = extRefValues.map(
    attr => extRef.getAttribute(attr) ?? ''
  );

  const srcLDInst =
    extRef.getAttribute('srcLDInst') ?? extRef.getAttribute('ldInst');
  const srcLNClass = extRef.getAttribute('srcLNClass') ?? 'LLN0';

  const controlBlockFromSrc = Array.from(
    extRef
      .closest('SCL')!
      .querySelectorAll(
        `IED[name="${srcIedName}"] LDevice[inst="${srcLDInst}"] > LN0[lnClass="${srcLNClass}"]${
          srcPrefix !== '' ? `[prefix="${srcPrefix}"]` : ''
        }${srcLNInst !== '' ? `[inst="${srcLNInst}"]` : ''} > ${
          controlTag[controlType]
        }[name="${srcCBName}"]`
      )
  );

  if (controlBlockFromSrc) return controlBlockFromSrc;

  // Ed 1 this is more complicated as control blocks not explicitly
  console.log('Ed 1');

  const fcdas = findFCDAs(extRef);
  const cbTags =
    serviceTypeControlBlockTags[extRef.getAttribute('serviceType') ?? 'NONE'] ??
    [];
  const controlBlocks = new Set(
    fcdas.flatMap(fcda => {
      const dataSet = fcda.parentElement!;
      const dsName = dataSet.getAttribute('name') ?? '';
      const anyLN = dataSet.parentElement!;
      return cbTags
        .flatMap(tag => Array.from(anyLN.getElementsByTagName(tag)))
        .filter(cb => cb.getAttribute('datSet') === dsName);
    })
  );
  return Array.from(controlBlocks);
}

// import { translate } from 'lit-translate';

/**
 * Editor for GOOSE and SMV supervision LNs
 */
export default class Supervision extends LitElement {
  @property({ attribute: false })
  doc!: XMLDocument;

  @property() docName!: string;

  @property() controlType: 'GOOSE' | 'SV' = 'GOOSE';

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

  @state()
  private get selectedIed(): Element | undefined {
    // When there is no IED selected, or the selected IED has no parent (IED has been removed)
    // select the first IED from the List.
    if (this.selectedIEDs.length >= 1) {
      return this.iedList.find(element => {
        const iedName = getNameAttribute(element);
        return this.selectedIEDs[0] === iedName;
      });
    }
    return undefined;
  }

  protected updated(_changedProperties: PropertyValues): void {
    super.updated(_changedProperties);

    // When the document is updated, we reset the selected IED.
    if (_changedProperties.has('doc')) {
      this.selectedIEDs = [];

      if (this.iedList.length > 0) {
        const iedName = getNameAttribute(this.iedList[0]);
        if (iedName) {
          this.selectedIEDs = [iedName];
        }
      }
    }
  }

  // <LN lnClass="LGOS" inst="2" lnType="Dummy.LGOS">
  // 					<Private type="OpenSCD.create"/>
  // 					<DOI name="GoCBRef">
  // 						<DAI name="setSrcRef">
  // 							<Val>GOOSE_Publisher2QB2_Disconnector/LLN0.GOOSE2</Val>
  // 						</DAI>
  // 					</DOI>
  // 				</LN>

  renderSupervisionNode(lN: Element): TemplateResult {
    return html`<div class="item-grouper">
      <mwc-list-item
        class="sup-ln mitem"
        noninteractive
        graphic="icon"
        data-ln=${identity(lN)}
        value="${identity(lN)}"
      >
        <span>${removeIedPart(identity(lN))}</span>
        <span slot="secondary">${identity(lN)}</span>
        <mwc-icon slot="graphic">monitor_heart</mwc-icon>
      </mwc-list-item>
      <mwc-icon-button
        class="sup-btn"
        icon="edit"
        data-ln=${identity(lN)}
      ></mwc-icon-button>
      <mwc-icon-button
        class="sup-btn"
        icon="delete"
        data-ln=${identity(lN)}
      ></mwc-icon-button>
    </div>`;
  }

  private getSupervisionLNs(): Element[] {
    if (this.doc && this.selectedIed) {
      return Array.from(
        this.selectedIed.querySelectorAll(
          `LN[lnClass="${supervisionLnType[this.controlType]}"]`
        )
      );
    }
    return [];
  }

  private getControlElements(): Element[] {
    if (this.doc && this.selectedIed) {
      return Array.from(
        this.doc.querySelectorAll(`LN0 > ${controlTag[this.controlType]}`)
      );
    }
    return [];
  }

  // TODO: Add edit wizard
  // <mwc-icon-button
  //                     slot="meta"
  //                     icon="edit"
  //                     class="interactive"
  //                     @click=${() => this.openEditWizard(controlElement)}
  //                   ></mwc-icon-button>

  renderSupervisionLNs(): TemplateResult {
    // const supervisionControlBlockReferences = this.getSupervisionLNs().map(cb =>
    //   getSupervisionControlBlockRef(cb, this.controlType)
    // );

    // const supervisedControls = this.getControlElements()
    //   .filter(control =>
    //     supervisionControlBlockReferences.includes(
    //       controlBlockReference(control)
    //     )
    //   )
    //   .forEach();
    // console.log(supervisedControls);
    if (!this.selectedIed) return html``;

    const extRefs =
      Array.from(this.selectedIed.getElementsByTagName('ExtRef')) ?? [];

    const connectedControlBlockIds: Set<string> = new Set();
    extRefs.forEach(extRef => {
      const cbs = findControlBlocks(extRef, this.controlType);
      cbs.forEach(cb => connectedControlBlockIds.add(`${identity(cb)}`));
    });

    // <mwc-list class="column" activatable>

    return html`<mwc-list class="column mlist">
      ${this.getSupervisionLNs()
        .filter(lN => {
          const cbRef = getSupervisionControlBlockRef(lN, this.controlType);
          return cbRef !== null && cbRef !== '';
        })
        .map(lN => {
          const cbRef = getSupervisionControlBlockRef(lN, this.controlType);
          const controlElement =
            this.getControlElements().find(
              control => cbRef === controlBlockReference(control)
            ) ?? null;
          const cbSubscribed = extRefs.some(extRef =>
            findControlBlocks(extRef, this.controlType)
              .map(cb => controlBlockReference(cb))
              .includes(cbRef)
          );

          console.log('cbSubscribed', cbSubscribed);
          return html`${this.renderSupervisionNode(lN)}`;
        })}
    </mwc-list>`;
  }

  //  </mwc-list>
  //   <mwc-icon-button
  //   class="sup-btn"
  //   icon="link"
  //   data-ln=${identity(lN)}
  // ></mwc-icon-button>

  // ${this.renderControl(
  //   controlElement,
  //   connectedControlBlockIds
  // )}
  // <mwc-icon-button
  //   class="interactive column"
  //   icon="link"
  // ></mwc-icon-button>

  renderIcons(): TemplateResult {
    return html`<mwc-list class="column remover mlist">
      ${this.getSupervisionLNs()
        .filter(lN => {
          const cbRef = getSupervisionControlBlockRef(lN, this.controlType);
          return cbRef !== null && cbRef !== '';
        })
        .map(
          () => html`
            <mwc-icon-button
              class="interactive column button mitem unselected"
              icon="conversion_path"
            ></mwc-icon-button>
          `
        )}
    </mwc-list>`;
  }

  renderControl(
    controlElement: Element | null,
    connectedControlBlockIds: Set<string>
  ): TemplateResult {
    if (!controlElement) return html``;

    const isCbConnected = connectedControlBlockIds.has(
      `${identity(controlElement)}`
    );
    return html`<mwc-list-item
      noninteractive
      graphic="icon"
      class="mitem"
      twoline
      ?hasMeta=${isCbConnected}
      value="${identity(controlElement)}"
    >
      <span>${identity(controlElement)} </span>
      <span slot="secondary"
        >${controlElement?.getAttribute('datSet') ?? 'No dataset'}</span
      >
      <mwc-icon slot="graphic"
        >${this.controlType === 'GOOSE' ? gooseIcon : smvIcon}</mwc-icon
      >
      ${isCbConnected
        ? html`<mwc-icon slot="meta">data_check</mwc-icon>`
        : undefined}
    </mwc-list-item> `;
  }

  renderControls(): TemplateResult {
    if (!this.selectedIed) return html``;

    const extRefs =
      Array.from(this.selectedIed.getElementsByTagName('ExtRef')) ?? [];

    const connectedControlBlockIds: Set<string> = new Set();
    extRefs.forEach(extRef => {
      const cbs = findControlBlocks(extRef, this.controlType);
      cbs.forEach(cb => connectedControlBlockIds.add(`${identity(cb)}`));
    });

    return html`<mwc-list class="column mlist">
      ${this.getSupervisionLNs()
        .filter(lN => {
          const cbRef = getSupervisionControlBlockRef(lN, this.controlType);
          return cbRef !== null && cbRef !== '';
        })
        .map(lN => {
          const cbRef = getSupervisionControlBlockRef(lN, this.controlType);
          const controlElement =
            this.getControlElements().find(
              control => cbRef === controlBlockReference(control)
            ) ?? null;

          return html`${this.renderControl(
            controlElement,
            connectedControlBlockIds
          )}`;
        })}</mwc-list
    >`;
  }

  //   return html`<mwc-list activatable>
  //     ${this.getControlElements().map(controlElement => {
  //       console.log(controlBlockReference(controlElement));

  //       return html` <mwc-list-item
  //         noninteractive
  //         graphic="icon"
  //         twoline
  //         value="${identity(controlElement)}"
  //       >
  //         <span
  //           >${getNameAttribute(controlElement)}
  //           ${getDescriptionAttribute(controlElement)
  //             ? html`${getDescriptionAttribute(controlElement)}`
  //             : nothing}</span
  //         >
  //         <span slot="secondary">${identity(controlElement)}</span>
  //         <mwc-icon slot="graphic"
  //           >${this.controlType === 'GOOSE' ? gooseIcon : smvIcon}</mwc-icon
  //         >
  //       </mwc-list-item>`;
  //     })}
  //   </mwc-list>`;
  // }

  renderControlSelector(): TemplateResult {
    return html`<div id="controlSelector" class="column">
      <mwc-icon-button-toggle
        id="controlType"
        title="${msg('Change between GOOSE and Sampled Value publishers')}"
        @click=${() => {
          if (this.controlType === 'GOOSE') {
            this.controlType = 'SV';
          } else {
            this.controlType = 'GOOSE';
          }
        }}
        >${gooseActionIcon}${smvActionIcon}
      </mwc-icon-button-toggle>
      <h2 id="cbTitle">${msg(this.controlType)} Control Blocks</h2>
    </div>`;
  }

  renderIedSelector(): TemplateResult {
    return html`<div id="iedSelector">
      <oscd-filter-button
        id="iedFilter"
        icon="developer_board"
        header="IED Selector"
        @selected-items-changed="${(e: SelectedItemsChangedEvent) => {
          this.selectedIEDs = e.detail.selectedItems;
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
          : 'No IED Selected'}
        (${this.selectedIed?.getAttribute('type') ?? 'Unknown Type'})
      </h2>
    </div>`;
  }

  render(): TemplateResult {
    if (!this.doc) return html``;

    if (this.iedList.length === 0) return html`<h1>>No IEDs present</h1>`;

    return html`
    <div id="controlSection">
      ${this.renderIedSelector()}
    </div>
    <section>
      ${this.renderControlSelector()}
      <div class="column remover"></div>
      <h2 class="column">Supervision Logical Nodes</h2>
      ${this.renderControls()}
      ${this.renderIcons()}
      ${this.renderSupervisionLNs()}
      </div>
    </section>`;
  }

  //             ${this.renderControls()}
  // ${this.renderIcons()}
  //           ${this.renderControls()}

  static styles = css`
    ${styles}

    :host {
      width: 100vw;
      height: 100vh;
    }

    #cbTitle,
    #controlSelector,
    #controlSelector > mwc-formfield,
    #iedSelector {
      display: flex;
      flex-direction: row;
      justify-content: flex-start;
    }

    #iedSelector {
      padding-left: 20px;
      padding-top: 20px;
    }

    section {
      display: flex;
      flex-wrap: wrap;
      column-gap: 20px;
      padding: 20px;
    }

    #supervisionItems {
      display: flex;
      flex-direction: row;
    }

    .sup-ln,
    .sup-btn {
      display: inline-flex;
    }

    .sup-ln {
      justify-content: flex-start;
      width: 100%;
    }

    .button {
      --mdc-icon-size: 32px;
    }

    .item-grouper {
      display: flex;
      align-items: center;
    }

    .remover {
      max-width: 50px;
    }

    .mitem {
      height: 72px;
    }

    .mitem.button {
      justify-content: space-around;
    }

    .mitem.button:hover {
      color: red;
    }

    .column {
      display: flex;
      flex: 1 1 33%;
      flex-direction: column;
      justify-content: space-between;
    }
  `;
}
