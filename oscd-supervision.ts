import {
  css,
  html,
  LitElement,
  nothing,
  PropertyValues,
  TemplateResult,
} from 'lit';

// import { msg } from '@lit/localize';
import { property, state } from 'lit/decorators.js';

import '@material/mwc-button';
import '@material/mwc-formfield';
import '@material/mwc-textfield';
import '@material/mwc-list/mwc-radio-list-item';

import { styles } from './foundation/styles/styles.js';
import {
  compareNames,
  getDescriptionAttribute,
  getNameAttribute,
} from './foundation/foundation.js';

import './foundation/components/oscd-filter-button.js';

import type { SelectedItemsChangedEvent } from './foundation/components/oscd-filter-button.js';

// import { translate } from 'lit-translate';

/**
 * Editor for GOOSE and SMV supervision LNs
 */
export default class Supervision extends LitElement {
  @property({ attribute: false })
  doc!: XMLDocument;

  @property() docName!: string;

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

  render(): TemplateResult {
    if (!this.doc) return html``;

    if (this.iedList.length > 0) {
      return html`<section>
        <div id="controlSection" class="column">
          <div id="iedSelector">
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
          </div>
          <div id="cbTitle">
            <h2>Control Blocks</h2>
            <div id="controlSelector">
              <mwc-formfield label="GOOSE">
                <mwc-radio id="goose" name="view" value="goose"></mwc-radio>
              </mwc-formfield>
              <mwc-formfield label="SV">
                <mwc-radio id="sv" name="view" value="SV"></mwc-radio>
              </mwc-formfield>
            </div>
          </div>
        </div>
        <div class="column remover"></div>
        <div class="column">
          <h2>Supervision Logical Nodes</h2>
        </div>
      </section> `;
    }
    return html`<h1>>No IEDs present</h1>`;
  }

  static styles = css`
    ${styles}

    :host {
      width: 100vw;
      height: 100vh;
    }

    #cbTitle {
      justify-content: space-between;
    }

    #cbTitle,
    #controlSelector,
    #controlSelector > mwc-formfield,
    #iedSelector {
      display: flex;
    }

    section {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
      padding: 20px;
    }

    .remover {
      max-width: 50px;
    }

    .column {
      display: flex;
      flex: 1;
      flex-direction: column;
      justify-content: space-between;
    }
  `;
}
