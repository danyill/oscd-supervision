import {
  css,
  html,
  LitElement,
  nothing,
  PropertyValueMap,
  PropertyValues,
  TemplateResult,
} from 'lit';
import { msg } from '@lit/localize';
import { property, state } from 'lit/decorators.js';

import { newEditEvent, Remove } from '@openscd/open-scd-core';

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
  findControlBlocks,
  getDescriptionAttribute,
  getNameAttribute,
} from './foundation/foundation.js';

import './foundation/components/oscd-filter-button.js';

import type { SelectedItemsChangedEvent } from './foundation/components/oscd-filter-button.js';
import { identity } from './foundation/identities/identity.js';

import {
  gooseActionIcon,
  smvActionIcon,
  gooseIcon,
  smvIcon,
} from './foundation/icons.js';
import {
  controlBlockReference,
  isSupervisionModificationAllowed,
} from './foundation/subscription/subscription.js';

const controlTag = { GOOSE: 'GSEControl', SMV: 'SampledValueControl' };
const supervisionLnType = { GOOSE: 'LGOS', SMV: 'LSVS' };
const supervisionCBRef = { GOOSE: 'GoCBRef', SMV: 'SvCBRef' };

function removeIedPart(identityString: string | number): string {
  return `${identityString}`.split('>').slice(1).join('>').trim().slice(1);
}

function getSupervisionControlBlockRef(
  ln: Element,
  type: 'GOOSE' | 'SMV'
): string | null {
  return (
    ln.querySelector(
      `DOI[name="${supervisionCBRef[type]}"] > DAI[name="setSrcRef"] > Val`
    )?.textContent ?? null
  );
}

function extRefIsType(extRef: Element, type: 'GOOSE' | 'SMV'): boolean | null {
  return (
    extRef.getAttribute('serviceType') === type ||
    extRef.getAttribute('pServT') === type
  );
}

// import { translate } from 'lit-translate';

/**
 * Editor for GOOSE and SMV supervision LNs
 */
export default class Supervision extends LitElement {
  @property({ attribute: false })
  doc!: XMLDocument;

  @property() docName!: string;

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

  @state()
  connectedControlBlockIds: Set<string> = new Set();

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

  storeConnectedControlBlocks() {
    if (!this.selectedIed) return;
    const extRefs =
      Array.from(this.selectedIed.getElementsByTagName('ExtRef')) ?? [];

    this.connectedControlBlockIds = new Set();
    extRefs.forEach(extRef => {
      if (extRefIsType(extRef, 'GOOSE')) {
        findControlBlocks(extRef, 'GOOSE').forEach(cb =>
          this.connectedControlBlockIds.add(`${identity(cb)}`)
        );
      } else if (extRefIsType(extRef, 'SMV')) {
        findControlBlocks(extRef, 'SMV').forEach(cb =>
          this.connectedControlBlockIds.add(`${identity(cb)}`)
        );
      } else {
        // unknown type, must check both
        findControlBlocks(extRef, 'SMV').forEach(cb =>
          this.connectedControlBlockIds.add(`${identity(cb)}`)
        );
        findControlBlocks(extRef, 'SMV').forEach(cb =>
          this.connectedControlBlockIds.add(`${identity(cb)}`)
        );
      }
    });
    this.requestUpdate();
  }

  protected firstUpdated(): void {
    this.storeConnectedControlBlocks();
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

    if (_changedProperties.has('selectedIed') && this.selectedIed) {
      this.storeConnectedControlBlocks();
    }
  }

  renderSupervisionNode(lN: Element): TemplateResult {
    const description = getDescriptionAttribute(lN);
    return html`<div class="item-grouper">
      <mwc-list-item
        noninteractive
        ?twoline=${!!description}
        class="sup-ln mitem"
        graphic="icon"
        data-ln="${identity(lN)}"
        value="${identity(lN)}"
      >
        <span>${removeIedPart(identity(lN))}</span>
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
      <mwc-icon-button
        class="sup-btn"
        icon="delete"
        label="${msg('Delete supervision logical node')}"
        data-ln="${identity(lN)}"
        ?disabled=${!isSupervisionModificationAllowed(
          this.selectedIed!,
          supervisionLnType[this.controlType]
        )}
        @click=${() => {
          if (
            isSupervisionModificationAllowed(
              this.selectedIed!,
              supervisionLnType[this.controlType]
            )
          ) {
            const removeEdit: Remove = {
              node: lN,
            };
            this.dispatchEvent(newEditEvent(removeEdit));
          }
        }}
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

  renderSupervisionLNs(onlyUsed = false, onlyUnused = false): TemplateResult {
    if (!this.selectedIed) return html``;
    return html` ${this.getSupervisionLNs()
      .filter(lN => {
        const cbRef = getSupervisionControlBlockRef(lN, this.controlType);
        const cbRefUsed = cbRef !== null && cbRef !== '';
        return (cbRefUsed && onlyUsed) || (!cbRefUsed && onlyUnused);
      })
      .map(lN => html`${this.renderSupervisionNode(lN)}`)}`;
  }

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
              label="${msg('Remove supervision of this control block')}"
              class="column button mitem"
              icon="conversion_path"
              ?disabled=${!isSupervisionModificationAllowed(
                this.selectedIed!,
                supervisionLnType[this.controlType]
              )}
            ></mwc-icon-button>
          `
        )}
    </mwc-list>`;
  }

  renderControl(
    controlElement: Element | null,
    interactive: boolean = false
  ): TemplateResult {
    if (!controlElement) return html``;

    const isCbConnected = this.connectedControlBlockIds.has(
      `${identity(controlElement)}`
    );
    return html`<mwc-list-item
      ?noninteractive=${!interactive}
      graphic="icon"
      class="mitem"
      twoline
      ?hasMeta=${isCbConnected}
      value="${identity(controlElement)}"
    >
      <span>${identity(controlElement)} </span>
      <span slot="secondary"
        >${controlElement?.getAttribute('datSet') ?? 'No dataset'}
        ${getDescriptionAttribute(controlElement) ??
        getDescriptionAttribute(controlElement)}
      </span>
      <mwc-icon slot="graphic"
        >${this.controlType === 'GOOSE' ? gooseIcon : smvIcon}</mwc-icon
      >
      ${isCbConnected
        ? html`<!-- TODO: The title is non-interactive so not much use - can be fixed? --><mwc-icon
              class="interactive"
              slot="meta"
              title="${msg('This IED subscribes to this control block')}"
              >data_check</mwc-icon
            >`
        : undefined}
    </mwc-list-item> `;
  }

  renderUnusedControls(): TemplateResult {
    if (!this.selectedIed) return html``;
    return html` ${this.getControlElements()
      .filter(
        control => !this.connectedControlBlockIds.has(`${identity(control)}`)
      )
      .map(
        controlElement => html`${this.renderControl(controlElement, true)}`
      )}`;
  }

  renderUsedControls(): TemplateResult {
    if (!this.selectedIed) return html``;

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

          return html`${this.renderControl(controlElement)}`;
        })}</mwc-list
    >`;
  }

  renderControlSelector(): TemplateResult {
    return html`<div id="controlSelector" class="column">
      <mwc-icon-button-toggle
        id="controlType"
        label="${msg('Change between GOOSE and Sampled Value publishers')}"
        @click=${() => {
          if (this.controlType === 'GOOSE') {
            this.controlType = 'SMV';
          } else {
            this.controlType = 'GOOSE';
          }
        }}
        >${gooseActionIcon}${smvActionIcon}
      </mwc-icon-button-toggle>
      <h2 id="cbTitle">${msg(this.controlType)} Control Blocks</h2>
    </div>`;
  }

  renderInfo(): TemplateResult {
    return html`${this.selectedIed &&
    !isSupervisionModificationAllowed(
      this.selectedIed,
      supervisionLnType[this.controlType]
    )
      ? html`<mwc-icon-button
          title="${msg('This IED does not support supervision modification')}"
          icon="warning"
        ></mwc-icon-button>`
      : nothing}`;
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
      ${this.renderInfo()}
    </div>
    <section>
      ${this.renderControlSelector()}
      <div class="column remover"></div>
      <h2 class="column">Supervision Logical Nodes</h2>
      ${this.renderUsedControls()}
      ${this.renderIcons()}
      <mwc-list class="column mlist">
        ${this.renderSupervisionLNs(true, false)}
      </mwc-list>
      </div>
    </section>
    <section class="unused">
      <div class="column-unused">
        <h2>${msg(`Unsupervised ${msg(this.controlType)} Control Blocks`)}</h2>
      <oscd-filtered-list activatable>
        ${this.renderUnusedControls()}
      </oscd-filtered-list>
      </div>
      <hr>
      <div class="column-unused">
        <h2>${msg('Unused Supervision Logical Nodes')}</h2>
        <oscd-filtered-list activatable>
          ${this.renderSupervisionLNs(false, true)}
        </oscd-filtered-list>
      </div>
    </section>
    `;
  }

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

    #controlSection {
      display: flex;
      justify-content: space-between;
      padding: 20px;
    }

    section {
      display: flex;
      flex-wrap: wrap;
      column-gap: 20px;
      padding: 20px;
    }

    section.unused {
      flex-wrap: nowrap;
    }

    #supervisionItems {
      display: flex;
      flex-direction: row;
    }

    .sup-ln,
    .sup-btn {
      display: inline-flex;
    }

    .sup-btn {
      /* TODO: Discuss with Christian - actually need a theme in OpenSCD core! */
      --mdc-theme-text-disabled-on-light: LightGray;
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
      /* TODO: Discuss with Christian - actually need a theme in OpenSCD core! */
      --mdc-theme-text-disabled-on-light: LightGray;
    }

    .mitem.button:hover {
      /* TODO: Convert to OpenSCD theme! */
      color: red;
    }

    .column {
      display: flex;
      flex: 1 1 33%;
      flex-direction: column;
      justify-content: space-between;
    }

    .column-unused {
      display: flex;
      flex: 1 1 50%;
      flex-direction: column;
    }
  `;
}
