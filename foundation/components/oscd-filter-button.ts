import { css, html, TemplateResult, unsafeCSS } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';

import '@material/mwc-icon-button';
import '@material/mwc-dialog';

import type { Dialog } from '@material/mwc-dialog';

import { OscdFilteredList } from './oscd-filtered-list.js';

export interface SelectedItemsChangedDetail {
  selectedItems: string[];
}

// TODO: Why is CustomEventInit a linter error?
export type SelectedItemsChangedEvent = CustomEvent<SelectedItemsChangedDetail>;
function newSelectedItemsChangedEvent(
  selectedItems: string[],
  eventInitDict?: CustomEventInit<SelectedItemsChangedDetail>
): SelectedItemsChangedEvent {
  return new CustomEvent<SelectedItemsChangedDetail>('selected-items-changed', {
    bubbles: true,
    composed: true,
    ...eventInitDict,
    detail: { selectedItems, ...eventInitDict?.detail },
  });
}

declare global {
  interface ElementEventMap {
    ['selected-items-changed']: SelectedItemsChangedEvent;
  }
}

/**
 * A mwc-list with mwc-textfield that filters the list items for given or separated terms
 */
@customElement('oscd-filter-button')
export class FilterButton extends OscdFilteredList {
  @property()
  header!: TemplateResult | string;

  @property()
  icon!: string;

  @property({ type: Boolean })
  disabled = false;

  @query('#filterDialog')
  private filterDialog!: Dialog;

  private toggleList(): void {
    this.filterDialog.show();
  }

  private onClosing(): void {
    const selectedItems: string[] = [];
    if (this.selected) {
      if (this.selected instanceof Array) {
        this.selected.forEach(item => selectedItems.push(item.value));
      } else {
        selectedItems.push(this.selected.value);
      }
      this.dispatchEvent(newSelectedItemsChangedEvent(selectedItems));
    }
  }

  render() {
    return html`
      <mwc-icon-button
        icon="${this.icon}"
        @click="${this.toggleList}"
        ?disabled="${this.disabled}"
      >
        <slot name="icon"></slot>
      </mwc-icon-button>
      <mwc-dialog
        id="filterDialog"
        heading="${this.header ? this.header : 'Filter'}"
        scrimClickAction=""
        @closing="${() => this.onClosing()}"
      >
        ${super.render()}
        <mwc-button slot="primaryAction" dialogAction="close">
          Close
        </mwc-button>
      </mwc-dialog>
    `;
  }

  static styles = css`
    ${unsafeCSS(OscdFilteredList.styles)}

    mwc-icon-button {
      color: var(--mdc-theme-on-surface);
    }

    mwc-dialog {
      --mdc-dialog-max-height: calc(100vh - 150px);
    }
  `;
}
