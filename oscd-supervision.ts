import {
  css,
  html,
  LitElement,
  nothing,
  PropertyValues,
  TemplateResult,
} from 'lit';
import { msg } from '@lit/localize';
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

import './foundation/components/oscd-filter-button.js';
import './foundation/components/oscd-filtered-list.js';

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
  instantiateSubscriptionSupervision,
  isSupervisionModificationAllowed,
  removeSubscriptionSupervision,
} from './foundation/subscription/subscription.js';

import type { OscdFilteredList } from './foundation/components/oscd-filtered-list.js';
import type { SelectedItemsChangedEvent } from './foundation/components/oscd-filter-button.js';

const controlTag = { GOOSE: 'GSEControl', SMV: 'SampledValueControl' };
const supervisionLnType = { GOOSE: 'LGOS', SMV: 'LSVS' };

function removeIedPart(identityString: string | number): string {
  return `${identityString}`.split('>').slice(1).join('>').trim().slice(1);
}

function getSupervisionControlBlockRef(ln: Element): string | null {
  const type = ln.getAttribute('lnClass') === 'LGOS' ? 'GoCBRef' : 'SvCBRef';

  return (
    ln.querySelector(`DOI[name="${type}"] > DAI[name="setSrcRef"] > Val`)
      ?.textContent ?? null
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

  // TODO: Do I need to track edit count with a state?

  @property() docName!: string;

  @property() controlType: 'GOOSE' | 'SMV' = 'GOOSE';

  @property() editCount!: number;

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
  connectedControlBlockIds: Array<string> = [];

  @state()
  supervisedControlBlockIds: Array<string> = [];

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

  selectedControl: Element | null = null;

  selectedSupervision: Element | null = null;

  newSupervision = false;

  @query('#unusedControls')
  selectedUnusedControlsListUI!: List;

  @query('#unusedSupervisions')
  selectedUnusedSupervisionsListUI!: List;

  @query('#unusedControls mwc-list-item[selected]')
  selectedUnusedControlUI?: ListItem;

  @query('#unusedSupervisions mwc-list-item[selected]')
  selectedUnusedSupervisionUI?: ListItem;

  protected updateControlBlockInfo() {
    this.updateConnectedControlBlocks();
    this.updateSupervisedControlBlocks();
  }

  protected updateConnectedControlBlocks() {
    if (!this.selectedIed) return;
    const extRefs =
      Array.from(this.selectedIed.getElementsByTagName('ExtRef')) ?? [];

    const connectedControlBlockIds: Set<string> = new Set();
    extRefs.forEach(extRef => {
      if (extRefIsType(extRef, 'GOOSE')) {
        findControlBlocks(extRef, 'GOOSE').forEach(cb =>
          connectedControlBlockIds.add(`${identity(cb)}`)
        );
      } else if (extRefIsType(extRef, 'SMV')) {
        findControlBlocks(extRef, 'SMV').forEach(cb =>
          connectedControlBlockIds.add(`${identity(cb)}`)
        );
      } else {
        // unknown type, must check both
        findControlBlocks(extRef, 'GOOSE').forEach(cb =>
          connectedControlBlockIds.add(`${identity(cb)}`)
        );
        findControlBlocks(extRef, 'SMV').forEach(cb =>
          connectedControlBlockIds.add(`${identity(cb)}`)
        );
      }
    });
    this.connectedControlBlockIds = Array.from(connectedControlBlockIds);
    console.log('updated connectedControlBlockIds');
    this.requestUpdate();
  }

  protected updateSupervisedControlBlocks() {
    this.supervisedControlBlockIds = [];
    const controlElements = [
      ...this.getControlElements('GOOSE'),
      ...this.getControlElements('SMV'),
    ];
    [
      ...this.getSupervisionLNs('GOOSE'),
      ...this.getSupervisionLNs('SMV'),
    ].forEach(lN => {
      const cbRef = getSupervisionControlBlockRef(lN);
      if (cbRef !== null && cbRef !== '') {
        const controlElement =
          controlElements.find(
            control => cbRef === controlBlockReference(control)
          ) ?? null;
        if (controlElement) {
          const controlId = `${identity(controlElement)}`;
          if (!this.supervisedControlBlockIds.includes(controlId))
            this.supervisedControlBlockIds.push(controlId);
        }
      }
    });
  }

  protected firstUpdated(): void {
    this.updateControlBlockInfo();
  }

  protected updated(_changedProperties: PropertyValues): void {
    super.updated(_changedProperties);

    // When the document is updated, we reset the selected IED.
    // TODO: Detect same document opened twice. Howto?
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
      this.updateControlBlockInfo();
    }
  }

  // eslint-disable-next-line class-methods-use-this
  renderUnusedSupervisionNode(lN: Element): TemplateResult {
    const description = getDescriptionAttribute(lN);
    return html`
      <mwc-list-item
        ?twoline=${!!description}
        class="sup-ln mitem"
        graphic="icon"
        data-supervision="${identity(lN)}"
        value="${identity(lN)}"
      >
        <span>${removeIedPart(identity(lN))}</span>
        ${description
          ? html`<span slot="secondary">${description}</span>`
          : nothing}
        <mwc-icon slot="graphic">monitor_heart</mwc-icon>
      </mwc-list-item>
      <!-- TODO: In future add wizards -->
    `;
  }

  renderSupervisionNode(lN: Element, interactive: boolean): TemplateResult {
    const description = getDescriptionAttribute(lN);
    return html`<div class="item-grouper">
      <mwc-list-item
        ?noninteractive=${!interactive}
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
        data-lN="${identity(lN)}"
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
            this.updateSupervisedControlBlocks();
          }
        }}
      ></mwc-icon-button>
    </div>`;
  }

  private getSupervisionLNs(controlType: 'GOOSE' | 'SMV'): Element[] {
    if (this.doc && this.selectedIed) {
      return Array.from(
        this.selectedIed.querySelectorAll(
          `LN[lnClass="${supervisionLnType[controlType]}"]`
        )
      );
    }
    return [];
  }

  private getControlElements(controlType: 'GOOSE' | 'SMV'): Element[] {
    if (this.doc && this.selectedIed) {
      const iedName = getNameAttribute(this.selectedIed!);
      return Array.from(
        this.doc.querySelectorAll(`LN0 > ${controlTag[controlType]}`)
      ).filter(cb => getNameAttribute(cb.closest('IED')!) !== iedName);
    }
    return [];
  }

  clearListSelections(): void {
    if (this.selectedUnusedControlUI) {
      this.selectedUnusedControlUI!.selected = false;
      this.selectedUnusedControlUI!.activated = false;
    }

    if (this.selectedUnusedSupervisionUI) {
      this.selectedUnusedSupervisionUI!.selected = false;
      this.selectedUnusedSupervisionUI!.activated = false;
    }

    // this.selectedUnusedControlsListUI.layout(true);
    // this.selectedUnusedSupervisionsListUI.layout(true);

    // this.requestUpdate();
  }

  // TODO: Need to work through how to show delete button with ca-d
  protected renderUnusedSupervisionLNs(
    onlyUsed = false,
    onlyUnused = false
  ): TemplateResult {
    if (!this.selectedIed) return html``;
    return html` ${this.getSupervisionLNs(this.controlType)
        .filter(lN => {
          const cbRef = getSupervisionControlBlockRef(lN);
          const cbRefUsed = cbRef !== null && cbRef !== '';
          return (cbRefUsed && onlyUsed) || (!cbRefUsed && onlyUnused);
        })
        .map(lN => html`${this.renderUnusedSupervisionNode(lN)}`)}
      <mwc-list-item
        hasMeta
        class="sup-ln mitem"
        graphic="icon"
        data-supervision="NEW"
        value="New Supervision LN"
      >
        <span>New Supervision LN</span>
        <mwc-icon slot="graphic">add_circle</mwc-icon>
      </mwc-list-item>`;
  }

  private renderSupervisionLNs(
    onlyUsed = false,
    onlyUnused = false
  ): TemplateResult {
    if (!this.selectedIed) return html``;
    return html` ${this.getSupervisionLNs(this.controlType)
      .filter(lN => {
        const cbRef = getSupervisionControlBlockRef(lN);
        const cbRefUsed = cbRef !== null && cbRef !== '';
        return (cbRefUsed && onlyUsed) || (!cbRefUsed && onlyUnused);
      })
      .map(lN => html`${this.renderSupervisionNode(lN, onlyUnused)}`)}`;
  }

  private renderSupervisionRemovalIcons(): TemplateResult {
    return html`<mwc-list class="column remover mlist">
      ${this.getSupervisionLNs(this.controlType)
        .filter(lN => {
          const cbRef = getSupervisionControlBlockRef(lN);
          return cbRef !== null && cbRef !== '';
        })
        .map(
          lN => html`
            <mwc-icon-button
              label="${msg('Remove supervision of this control block')}"
              class="column button mitem"
              icon="conversion_path"
              ?disabled=${!isSupervisionModificationAllowed(
                this.selectedIed!,
                supervisionLnType[this.controlType]
              )}
              @click=${() => {
                const cbRef = getSupervisionControlBlockRef(lN);
                const controlBlock =
                  this.getControlElements(this.controlType).find(
                    control => cbRef === controlBlockReference(control)
                  ) ?? null;
                if (controlBlock) {
                  const removeEdit = removeSubscriptionSupervision(
                    controlBlock,
                    this.selectedIed
                  );
                  this.dispatchEvent(newEditEvent(removeEdit));
                  // does this need to be awaited?
                  // await this.updateComplete;
                  this.updateSupervisedControlBlocks();
                  this.requestUpdate();
                }
              }}
            ></mwc-icon-button>
          `
        )}
    </mwc-list>`;
  }

  private renderControl(
    controlElement: Element | null,
    unused: boolean = false
  ): TemplateResult {
    if (!controlElement) return html``;

    return html`<mwc-list-item
      ?noninteractive=${!unused}
      graphic="icon"
      class="mitem"
      twoline
      data-control="${identity(controlElement)}"
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
    </mwc-list-item>`;
  }

  private renderUnusedControls(): TemplateResult {
    if (!this.selectedIed) return html``;
    return html`${this.getControlElements(this.controlType)
      .filter(
        control =>
          this.connectedControlBlockIds.includes(`${identity(control)}`) &&
          !this.supervisedControlBlockIds.includes(`${identity(control)}`)
      )
      .map(
        controlElement => html`${this.renderControl(controlElement, true)}`
      )}`;
  }

  private renderUsedControls(): TemplateResult {
    if (!this.selectedIed) return html``;

    return html`<mwc-list class="column mlist">
      ${this.getSupervisionLNs(this.controlType)
        .filter(lN => {
          const cbRef = getSupervisionControlBlockRef(lN);
          return cbRef !== null && cbRef !== '';
        })
        .map(lN => {
          const cbRef = getSupervisionControlBlockRef(lN);
          const controlElement =
            this.getControlElements(this.controlType).find(
              control => cbRef === controlBlockReference(control)
            ) ?? null;

          return html`${this.renderControl(controlElement)}`;
        })}</mwc-list
    >`;
  }

  private renderControlSelector(): TemplateResult {
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
      <h2 id="cbTitle">
        ${this.controlType === 'GOOSE'
          ? msg('GOOSE Control Blocks')
          : msg('SV Control Blocks')}
      </h2>
    </div>`;
  }

  private renderInfo(): TemplateResult {
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

  private renderIedSelector(): TemplateResult {
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

  private createSupervision(
    selectedControl: Element,
    selectedSupervision: Element | null,
    newSupervision: boolean
  ) {
    let edits: Edit[];

    if (newSupervision) {
      edits = instantiateSubscriptionSupervision(
        selectedControl,
        this.selectedIed
      );
    } else {
      edits = instantiateSubscriptionSupervision(
        selectedControl,
        this.selectedIed,
        selectedSupervision ?? undefined
      );
    }
    this.dispatchEvent(newEditEvent(edits));
    this.updateSupervisedControlBlocks();
  }

  private renderUnusedControlList(): TemplateResult {
    return html`<oscd-filtered-list
      id="unusedControls"
      activatable
      @selected=${(ev: SingleSelectedEvent) => {
        console.log('control');
        const selectedListItem = (<ListItemBase>(
          (<OscdFilteredList>ev.target).selected
        ))!;
        if (!selectedListItem) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
          console.log(
            'connecting',
            identity(this.selectedControl),
            identity(this.selectedSupervision)
          );
          this.createSupervision(
            this.selectedControl,
            this.selectedSupervision,
            this.newSupervision
          );
          this.selectedControl = null;
          this.selectedSupervision = null;
          this.newSupervision = false;
        }

        this.clearListSelections();
        this.selectedControl = selectedControl;
      }}
    >
      ${this.renderUnusedControls()}
    </oscd-filtered-list>`;
  }

  private renderUnusedSupervisionList(): TemplateResult {
    return html`<oscd-filtered-list
      id="unusedSupervisions"
      activatable
      @selected=${(ev: SingleSelectedEvent) => {
        console.log('supervision');
        const selectedListItem = (<ListItemBase>(
          (<OscdFilteredList>ev.target).selected
        ))!;
        if (!selectedListItem) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { supervision } = selectedListItem.dataset;
        const selectedSupervision = <Element>(
          this.doc.querySelector(selector('LN', supervision ?? 'Unknown'))
        );
        if (supervision === 'NEW') {
          this.newSupervision = true;
        }

        this.selectedSupervision = selectedSupervision;
        if (
          this.selectedControl &&
          (this.selectedSupervision || this.newSupervision)
        ) {
          console.log(
            'connecting',
            identity(this.selectedControl),
            identity(this.selectedSupervision)
          );
          this.createSupervision(
            this.selectedControl,
            this.selectedSupervision,
            this.newSupervision
          );
          this.selectedControl = null;
          this.selectedSupervision = null;
          this.newSupervision = false;
        }

        this.clearListSelections();
      }}
    >
      ${this.renderUnusedSupervisionLNs(false, true)}
    </oscd-filtered-list>`;
  }

  protected render(): TemplateResult {
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
      ${this.renderSupervisionRemovalIcons()}
      <mwc-list class="column mlist">
        ${this.renderSupervisionLNs(true, false)}
      </mwc-list>
      </div>
    </section>
    <section class="unused">
      <div class="column-unused">
        <h2>${
          this.controlType === 'GOOSE'
            ? msg(`Subscribed GOOSE Control Blocks`)
            : msg(`Subscribed SV Control Blocks`)
        }</h2>
        ${this.renderUnusedControlList()}
      </div>
      <hr>
      <div class="column-unused">
        <h2>${msg('Available Supervision Logical Nodes')}</h2>
        ${this.renderUnusedSupervisionList()}
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
      flex: 1 1 48%;
      flex-direction: column;
    }
  `;
}
