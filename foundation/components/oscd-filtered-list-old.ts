import { customElement, property, query, state } from 'lit/decorators.js';

import '@material/mwc-checkbox';
import '@material/mwc-formfield';
import '@material/mwc-textfield';
import { CheckListItem } from '@material/mwc-list/mwc-check-list-item';
import { List } from '@material/mwc-list';
import { ListBase } from '@material/mwc-list/mwc-list-base';
import { ListItemBase } from '@material/mwc-list/mwc-list-item-base';
import type { TextField } from '@material/mwc-textfield';
import { css, html, unsafeCSS } from 'lit';

function slotItem(item: Element): Element {
  if (!item.closest('oscd-filtered-list') || !item.parentElement) return item;
  // eslint-disable-next-line no-use-before-define
  if (item.parentElement instanceof OscdFilteredListOld) return item;
  return slotItem(item.parentElement);
}

function hideFiltered(item: ListItemBase, searchText: string): void {
  const itemInnerText = `${item.innerText}\n`;
  const childInnerText = Array.from(item.children)
    .map(child => (<HTMLElement>child).innerText)
    .join('\n');
  const { value } = item;

  const filterTarget: string = (
    itemInnerText +
    childInnerText +
    value
  ).toUpperCase();

  const terms: string[] = searchText
    .toUpperCase()
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .trim()
    .split(/\s+/g);

  // eslint-disable-next-line no-unused-expressions
  (terms.length === 1 && terms[0] === '') ||
  terms.every(term => {
    // regexp escape
    const reTerm = new RegExp(
      `*${term}*`.replace(/\*/g, '.*').replace(/\?/g, '.{1}'),
      'i'
    );
    return reTerm.test(filterTarget);
  })
    ? slotItem(item).classList.remove('hidden')
    : slotItem(item).classList.add('hidden');
}

/**
 * A mwc-list with mwc-textfield that filters the list items for given or separated terms.
 * This is based on a legacy code base which is no longer compatible with the @open-scd/oscd-filtered-list
 * component.
 */
@customElement('oscd-filtered-list-old')
export class OscdFilteredListOld extends ListBase {
  /** search mwc-textfield label property */
  @property({ type: String })
  searchFieldLabel?: string;

  /** Whether the check all option (checkbox next to search text field) is activated */
  @property({ type: Boolean })
  disableCheckAll = false;

  @state()
  private get existCheckListItem(): boolean {
    return this.items.some(item => item instanceof CheckListItem);
  }

  @state()
  private get isAllSelected(): boolean {
    return this.items
      .filter(item => !item.disabled)
      .filter(item => item instanceof CheckListItem)
      .every(checkItem => checkItem.selected);
  }

  @state()
  private get isSomeSelected(): boolean {
    return this.items
      .filter(item => !item.disabled)
      .filter(item => item instanceof CheckListItem)
      .some(checkItem => checkItem.selected);
  }

  @query('mwc-textfield') searchField!: TextField;

  private onCheckAll(): void {
    const select = !this.isAllSelected;
    this.items
      .filter(item => !item.disabled && !item.classList.contains('hidden'))
      .forEach(item => {
        // eslint-disable-next-line no-param-reassign
        item.selected = select;
      });
  }

  onFilterInput(): void {
    Array.from(
      this.querySelectorAll(
        'mwc-list-item, mwc-check-list-item, mwc-radio-list-item'
      )
    ).forEach(item =>
      hideFiltered(item as ListItemBase, this.searchField.value)
    );
  }

  protected onListItemConnected(e: CustomEvent): void {
    super.onListItemConnected(e);
    this.requestUpdate();
  }

  constructor() {
    super();
    this.addEventListener('selected', () => {
      this.requestUpdate();
    });
  }

  private renderCheckAll() {
    return this.existCheckListItem && !this.disableCheckAll
      ? html`<mwc-formfield class="checkall"
          ><mwc-checkbox
            ?indeterminate=${!this.isAllSelected && this.isSomeSelected}
            ?checked=${this.isAllSelected}
            @change=${() => {
              this.onCheckAll();
            }}
          ></mwc-checkbox
        ></mwc-formfield>`
      : html``;
  }

  render() {
    return html`<div id="tfcontainer">
        <abbr title="${this.searchFieldLabel ?? 'filter'}"
          ><mwc-textfield
            label="${this.searchFieldLabel ?? ''}"
            iconTrailing="search"
            outlined
            @input=${() => this.onFilterInput()}
          ></mwc-textfield
        ></abbr>
        ${this.renderCheckAll()}
      </div>
      ${super.render()}`;
  }

  // TODO: Is it possible to remove the any typing here?
  static styles: any = css`
    ${unsafeCSS(List.styles)}

    #tfcontainer {
      display: flex;
      flex: auto;
    }

    ::slotted(.hidden) {
      display: none;
    }

    abbr {
      display: flex;
      flex: auto;
      margin: 8px;
      text-decoration: none;
      border-bottom: none;
    }

    mwc-textfield {
      width: 100%;
      --mdc-shape-small: 28px;
    }

    mwc-formfield.checkall {
      padding-right: 8px;
    }

    .mdc-list {
      padding-inline-start: 0px;
    }
  `;
}
