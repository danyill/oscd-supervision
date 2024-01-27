/* eslint-disable func-names */
import { visualDiff } from '@web/test-runner-visual-regression';

import {
  setViewport,
  resetMouse,
  sendMouse,
  sendKeys
} from '@web/test-runner-commands';

import { fixture, html } from '@open-wc/testing';

import '@openscd/open-scd-core/open-scd.js';
import type { OpenSCD } from '@openscd/open-scd-core/open-scd.js';
import OscdSupervision from '../../oscd-supervision.js';

// import { test, expect } from '@playwright/test';

import { midEl } from './test-support.js';

const factor = window.process && process.env.CI ? 4 : 2;

const standardWait = 100;

function timeout(ms: number) {
  return new Promise(res => {
    setTimeout(res, ms * factor);
  });
}

mocha.timeout(12000 * factor);

async function changeIED(plugin: OscdSupervision, iedName: string) {
  const iedFilter = plugin.shadowRoot!.querySelector('#iedFilter')!;
  await sendMouse({
    type: 'click',
    button: 'left',
    position: midEl(iedFilter!)
  });
  await plugin.updateComplete;
  await timeout(standardWait);

  const ied = iedFilter.querySelector(
    `mwc-radio-list-item[value="${iedName}"]`
  );
  await sendMouse({
    type: 'click',
    button: 'left',
    position: midEl(ied!)
  });
  await timeout(standardWait);

  const closeButton = iedFilter.shadowRoot!.querySelector(
    'mwc-button[slot="primaryAction"]'
  );
  await sendMouse({
    type: 'click',
    button: 'left',
    position: midEl(closeButton!)
  });
  await timeout(standardWait);
}

async function changeControlType(plugin: OscdSupervision) {
  const controlType = plugin.shadowRoot!.querySelector('#controlType');
  await sendMouse({
    type: 'click',
    button: 'left',
    position: midEl(controlType!)
  });

  await plugin.updateComplete;
  await timeout(standardWait);
}

function testName(test: any): string {
  return test.test!.fullTitle().trim();
}

async function tryViewportSet(): Promise<void> {
  // target 1920x1080 screen-resolution, giving typical browser size of...
  await setViewport({ width: 1745, height: 1045 });
}

async function resetMouseState(): Promise<void> {
  await timeout(70);
  await resetMouse();
  await sendMouse({ type: 'click', position: [0, 0] });
}

// avoid prefix on screenshots
const pluginName = '';

describe(pluginName, () => {
  let editor: OpenSCD;
  let plugin: OscdSupervision;
  let script: HTMLScriptElement;

  beforeEach(async () => {
    const plugins = {
      menu: [
        {
          name: 'Open File',
          translations: { de: 'Datei öffnen' },
          icon: 'folder_open',
          active: true,
          src: 'https://openscd.github.io/oscd-open/oscd-open.js'
        },
        {
          name: 'Save File',
          translations: { de: 'Datei speichern' },
          icon: 'save',
          active: true,
          src: 'https://openscd.github.io/oscd-save/oscd-save.js'
        }
      ],
      editor: [
        {
          name: 'Supervision',
          translations: { de: 'Überwachung', pt: 'Supervisão' },
          icon: 'ecg',
          active: true,
          src: '/dist/oscd-supervision.js'
        }
      ]
    };

    script = document.createElement('script');
    script.type = 'module';

    script.textContent = `
    const _customElementsDefine = window.customElements.define;
    window.customElements.define = (name, cl, conf) => {
      if (!customElements.get(name)) {
        try {
          _customElementsDefine.call(
            window.customElements,
            name,
            cl,
            conf
          );
        } catch (e) {
          console.warn(e);
        }
      }
    };
  `;
    document.head.appendChild(script);

    const ed: OpenSCD = await fixture(
      html`<open-scd language="en" .plugins="${plugins}"></open-scd>`
    );
    document.body.prepend(ed);

    editor = document.querySelector('open-scd')!;
    plugin = document
      .querySelector('open-scd')!
      .shadowRoot!.querySelector(editor.editor)!;

    await document.fonts.ready;
  });

  afterEach(() => {
    editor.remove();
    plugin.remove();
    script.remove();
  });

  let doc: XMLDocument;

  describe('LGOS', () => {
    describe('shows supervisions', () => {
      beforeEach(async () => {
        localStorage.clear();
        await tryViewportSet();
        resetMouse();

        doc = await fetch('/test/fixtures/supervisions.scd')
          .then(response => response.text())
          .then(str => new DOMParser().parseFromString(str, 'application/xml'));

        editor.docName = 'supervisions.scd';
        editor.docs[editor.docName] = doc;

        await editor.updateComplete;
        await plugin.updateComplete;
      });

      afterEach(async () => {
        localStorage.clear();
      });

      it('and shows nothing if no IEDs present', async function () {
        localStorage.clear();
        await tryViewportSet();
        resetMouse();

        doc = await fetch('/test/fixtures/no-IEDs-present.scd')
          .then(response => response.text())
          .then(str => new DOMParser().parseFromString(str, 'application/xml'));

        editor.docName = 'no-IEDS.scd';
        editor.docs[editor.docName] = doc;

        await editor.updateComplete;
        await plugin.updateComplete;

        await timeout(standardWait);
        await resetMouseState();
        await visualDiff(plugin, testName(this));
      });

      it('and shows no supervisions if not present', async function () {
        await timeout(standardWait);
        await resetMouseState();
        await visualDiff(plugin, testName(this));
      });

      it('and shows IEDs for selection', async function () {
        const iedFilter = plugin.shadowRoot!.querySelector('#iedFilter')!;
        await sendMouse({
          type: 'click',
          button: 'left',
          position: midEl(iedFilter!)
        });
        await plugin.updateComplete;

        const ied = iedFilter.querySelector(
          'mwc-radio-list-item[value="GOOSE_Subscriber1"]'
        );
        await sendMouse({
          type: 'click',
          button: 'left',
          position: midEl(ied!)
        });

        await timeout(standardWait);
        await resetMouseState();
        await visualDiff(plugin, testName(this));
      });

      it('for a change in IED', async function () {
        await changeIED(plugin, 'GOOSE_Subscriber1');

        await plugin.updateComplete;
        await timeout(standardWait);
        await visualDiff(plugin, testName(this));
      });

      it('cannot add existing supervisions if at maximum', async function () {
        await changeIED(plugin, 'GOOSE_Subscriber2');
        await timeout(standardWait);

        await resetMouseState();
        await visualDiff(plugin, testName(this));
      });

      it('can search descriptions on available supervisions', async function () {
        await changeIED(plugin, 'GOOSE_Subscriber4');
        await timeout(standardWait);

        const searchSupervisions = plugin
          .shadowRoot!.querySelector(
            'mwc-textfield#filterUnusedSupervisionInput'
          )!
          .shadowRoot!.querySelector('label > input');

        await sendMouse({
          type: 'click',
          button: 'left',
          position: midEl(searchSupervisions!)
        });
        await sendKeys({ type: 'Important1 Important2 "LGOS 2"' });

        await resetMouseState();
        await visualDiff(plugin, testName(this));
      });

      it('for a change in supervision to LSVS shows supervisions', async function () {
        await changeIED(plugin, 'GOOSE_Subscriber1');
        await timeout(standardWait);

        await changeControlType(plugin);
        await resetMouseState();
        await visualDiff(plugin, testName(this));
      });

      it('for a change in supervision to LSVS and back to LGOS shows supervisions', async function () {
        await changeIED(plugin, 'GOOSE_Subscriber1');
        await timeout(standardWait);

        await changeControlType(plugin);
        await plugin.updateComplete;
        await timeout(standardWait);

        await changeControlType(plugin);
        await plugin.updateComplete;
        await timeout(standardWait);

        await resetMouseState();
        await visualDiff(plugin, testName(this));
      });

      it('including where supervisions cannot be changed', async function () {
        await changeIED(plugin, 'GOOSE_Subscriber3');

        await plugin.updateComplete;
        await timeout(standardWait);
        await visualDiff(plugin, testName(this));
      });
    });

    describe('changes supervisions', () => {
      beforeEach(async () => {
        localStorage.clear();
        await tryViewportSet();
        resetMouse();

        doc = await fetch('/test/fixtures/supervisions.scd')
          .then(response => response.text())
          .then(str => new DOMParser().parseFromString(str, 'application/xml'));

        editor.docName = 'supervisions.scd';
        editor.docs[editor.docName] = doc;

        await editor.updateComplete;
        await plugin.updateComplete;
      });

      afterEach(async () => {
        localStorage.clear();
      });

      it('can disconnect a used supervision', async function () {
        await changeIED(plugin, 'GOOSE_Subscriber1');
        await timeout(standardWait);

        const removeButton = plugin.shadowRoot!.querySelector(
          'section > .mlist.remover > mwc-list-item[data-ln="GOOSE_Subscriber1>>GOOSE_Supervision> LGOS 1"] > mwc-icon'
        );
        await sendMouse({
          type: 'click',
          button: 'left',
          position: midEl(removeButton!)
        });

        await timeout(standardWait);
        await resetMouseState();
        await visualDiff(plugin, testName(this));
      });

      it('can delete a used supervision', async function () {
        await changeIED(plugin, 'GOOSE_Subscriber1');
        await timeout(standardWait);

        const deleteButton = plugin.shadowRoot!.querySelector(
          'section > .mlist.deleter > mwc-list-item[data-ln="GOOSE_Subscriber1>>GOOSE_Supervision> LGOS 2"] > mwc-icon'
        );
        await sendMouse({
          type: 'click',
          button: 'left',
          position: midEl(deleteButton!)
        });

        await timeout(standardWait);
        await resetMouseState();
        await visualDiff(plugin, testName(this));
      });

      it('can create a new supervision', async function () {
        await changeIED(plugin, 'GOOSE_Subscriber1');
        await timeout(standardWait);

        const createNewSupLn = plugin.shadowRoot!.querySelector(
          'section.unused mwc-icon-button#createNewLN'
        );
        await sendMouse({
          type: 'click',
          button: 'left',
          position: midEl(createNewSupLn!)
        });

        await timeout(standardWait);
        await resetMouseState();
        await visualDiff(plugin, testName(this));
      });

      it('can select an existing supervision', async function () {
        await changeIED(plugin, 'GOOSE_Subscriber4');
        await timeout(standardWait);

        const createNewSupLn = plugin.shadowRoot!.querySelector(
          'section.unused div.available-grouper > .filteredList > mwc-list > mwc-list-item[data-ln="GOOSE_Subscriber4>>GOOSE_Supervision> LGOS 2"]  '
        );
        await sendMouse({
          type: 'click',
          button: 'left',
          position: midEl(createNewSupLn!)
        });
        await timeout(standardWait * 2);

        await resetMouseState();
        await visualDiff(plugin, testName(this));
      });

      it('can select and assign an existing supervision', async function () {
        await changeIED(plugin, 'GOOSE_Subscriber4');
        await timeout(standardWait);

        const createNewSupLn = plugin.shadowRoot!.querySelector(
          'section.unused div.available-grouper > .filteredList > mwc-list > mwc-list-item[data-ln="GOOSE_Subscriber4>>GOOSE_Supervision> LGOS 2"]'
        );
        await sendMouse({
          type: 'click',
          button: 'left',
          position: midEl(createNewSupLn!)
        });
        await timeout(standardWait * 2);

        const existingCb = plugin.shadowRoot!.querySelector(
          'section.unused oscd-filtered-list#unusedControls > mwc-list-item[data-control="GOOSE_Publisher>>QB2_Disconnector>GOOSE2"]'
        );
        await sendMouse({
          type: 'click',
          button: 'left',
          position: midEl(existingCb!)
        });

        await timeout(standardWait);
        await resetMouseState();
        await visualDiff(plugin, testName(this));
      });

      it('can select and assign a new supervision', async function () {
        await changeIED(plugin, 'GOOSE_Subscriber4');
        await timeout(standardWait);

        const createNewSupLn = plugin.shadowRoot!.querySelector(
          'section.unused div.available-grouper > .filteredList > mwc-list > mwc-list-item[data-ln="NEW"]'
        );
        await sendMouse({
          type: 'click',
          button: 'left',
          position: midEl(createNewSupLn!)
        });
        await timeout(standardWait * 2);

        const existingCb = plugin.shadowRoot!.querySelector(
          'section.unused oscd-filtered-list#unusedControls > mwc-list-item[data-control="GOOSE_Publisher>>QB2_Disconnector>GOOSE2"]'
        );
        await sendMouse({
          type: 'click',
          button: 'left',
          position: midEl(existingCb!)
        });

        await timeout(standardWait);
        await resetMouseState();
        await visualDiff(plugin, testName(this));
      });

      it('can delete an unused supervision', async function () {
        await changeIED(plugin, 'GOOSE_Subscriber4');
        await timeout(standardWait);

        const deleteUnusedSupLn = plugin.shadowRoot!.querySelector(
          'section.unused div.available-grouper >  mwc-list.deleter > mwc-list-item[data-ln="GOOSE_Subscriber4>>GOOSE_Supervision> LGOS 2"]'
        );
        await sendMouse({
          type: 'click',
          button: 'left',
          position: midEl(deleteUnusedSupLn!)
        });
        await timeout(standardWait);

        await resetMouseState();
        await visualDiff(plugin, testName(this));
      });

      it('can reassign a supervision with no local subscriptions', async function () {
        await changeIED(plugin, 'GOOSE_Subscriber5');
        await timeout(standardWait);

        //  can assign
        const assignNewSupLn = plugin.shadowRoot!.querySelector(
          'section.unused div.available-grouper > .filteredList > mwc-list > mwc-list-item[data-ln="GOOSE_Subscriber5>>GOOSE_supervision> LGOS 2"]'
        );
        await sendMouse({
          type: 'click',
          button: 'left',
          position: midEl(assignNewSupLn!)
        });
        await plugin.updateComplete;
        await timeout(standardWait);

        const existingCb = plugin.shadowRoot!.querySelector(
          'section.unused oscd-filtered-list#unusedControls > mwc-list-item[data-control="GOOSE_Publisher>>QB2_Disconnector>GOOSE2"]'
        );
        await sendMouse({
          type: 'click',
          button: 'left',
          position: midEl(existingCb!)
        });

        await plugin.updateComplete;
        await timeout(standardWait);
        await resetMouseState();

        await visualDiff(plugin, testName(this));
      });

      it('can reassign a supervision with an invalid control block', async function () {
        await changeIED(plugin, 'GOOSE_Subscriber5');
        await timeout(standardWait);

        //  can assign
        const assignNewSupLn = plugin.shadowRoot!.querySelector(
          'section.unused div.available-grouper > .filteredList > mwc-list > mwc-list-item[data-ln="GOOSE_Subscriber5>>GOOSE_supervision> LGOS 1"]'
        );
        await sendMouse({
          type: 'click',
          button: 'left',
          position: midEl(assignNewSupLn!)
        });
        await plugin.updateComplete;
        await timeout(standardWait);

        const existingCb = plugin.shadowRoot!.querySelector(
          'section.unused oscd-filtered-list#unusedControls > mwc-list-item[data-control="GOOSE_Publisher>>QB2_Disconnector>GOOSE2"]'
        );
        await sendMouse({
          type: 'click',
          button: 'left',
          position: midEl(existingCb!)
        });

        await plugin.updateComplete;
        await timeout(standardWait);
        await resetMouseState();

        await visualDiff(plugin, testName(this));
      });

      it('can carry out a sequence of create, disconnect, delete and connect', async function () {
        // can create
        await changeIED(plugin, 'GOOSE_Subscriber1');
        await timeout(standardWait);

        const createNewSupLn = plugin.shadowRoot!.querySelector(
          'section.unused mwc-icon-button#createNewLN'
        );
        await sendMouse({
          type: 'click',
          button: 'left',
          position: midEl(createNewSupLn!)
        });
        await plugin.updateComplete;
        await timeout(standardWait);

        // can disconnect
        const removeButton = plugin.shadowRoot!.querySelector(
          'section > .mlist.remover > mwc-list-item[data-ln="GOOSE_Subscriber1>>GOOSE_Supervision> LGOS 2"] > mwc-icon'
        );
        await sendMouse({
          type: 'click',
          button: 'left',
          position: midEl(removeButton!)
        });
        await plugin.updateComplete;
        await timeout(standardWait);

        // can delete
        const deleteUnusedSupLn = plugin.shadowRoot!.querySelector(
          'section.unused div.available-grouper >  mwc-list.deleter > mwc-list-item[data-ln="GOOSE_Subscriber1>>GOOSE_Supervision> LGOS 2"]'
        );
        await sendMouse({
          type: 'click',
          button: 'left',
          position: midEl(deleteUnusedSupLn!)
        });
        await plugin.updateComplete;
        await timeout(standardWait);

        //  can assign
        const assignNewSupLn = plugin.shadowRoot!.querySelector(
          'section.unused div.available-grouper > .filteredList > mwc-list > mwc-list-item[data-ln="GOOSE_Subscriber1>>GOOSE_Supervision> LGOS 3"]'
        );
        await sendMouse({
          type: 'click',
          button: 'left',
          position: midEl(assignNewSupLn!)
        });
        await plugin.updateComplete;
        await timeout(standardWait);

        const existingCb = plugin.shadowRoot!.querySelector(
          'section.unused oscd-filtered-list#unusedControls > mwc-list-item[data-control="GOOSE_Publisher2>>QB2_Disconnector>GOOSE2"]'
        );
        await sendMouse({
          type: 'click',
          button: 'left',
          position: midEl(existingCb!)
        });

        await plugin.updateComplete;
        await timeout(standardWait);
        await resetMouseState();

        await visualDiff(plugin, testName(this));
      });

      it('can carry out a sequence of delete, connect and delete, connect', async function () {
        await changeIED(plugin, 'GOOSE_Subscriber1');
        await plugin.updateComplete;
        await timeout(standardWait * 2);

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _num of [1, 2]) {
          const deleteButton = plugin.shadowRoot!.querySelector(
            'section > .mlist.deleter > mwc-list-item[data-ln="GOOSE_Subscriber1>>GOOSE_Supervision> LGOS 2"] > mwc-icon'
          );
          await sendMouse({
            type: 'click',
            button: 'left',
            position: midEl(deleteButton!)
          });
          await plugin.updateComplete;
          await timeout(standardWait);

          //  can assign/connect
          const assignNewSupLn = plugin.shadowRoot!.querySelector(
            'section.unused div.available-grouper > .filteredList > mwc-list > mwc-list-item[data-ln="NEW"]'
          );
          await sendMouse({
            type: 'click',
            button: 'left',
            position: midEl(assignNewSupLn!)
          });
          await plugin.updateComplete;
          await timeout(standardWait);

          const existingCb = plugin.shadowRoot!.querySelector(
            'section.unused oscd-filtered-list#unusedControls > mwc-list-item[data-control="GOOSE_Publisher2>>QB2_Disconnector>GOOSE2"]'
          );
          await sendMouse({
            type: 'click',
            button: 'left',
            position: midEl(existingCb!)
          });
          await plugin.updateComplete;
          await timeout(standardWait);
        }

        await resetMouseState();
        await visualDiff(plugin, testName(this));
      });
    });
  });

  describe('LSVS', () => {
    //   describe('shows supervisions', () => {
    //     beforeEach(async () => {
    //       localStorage.clear();
    //       await tryViewportSet();
    //       resetMouse();
    //       doc = await fetch('/test/fixtures/supervisions.scd')
    //         .then(response => response.text())
    //         .then(str => new DOMParser().parseFromString(str, 'application/xml'));
    //       editor.docName = 'supervisions.scd';
    //       editor.docs[editor.docName] = doc;
    //       await editor.updateComplete;
    //       await plugin.updateComplete;
    //     });
    //     afterEach(async () => {
    //       localStorage.clear();
    //     });
    //     it('and shows nothing if no IEDs present', async function () {
    //       localStorage.clear();
    //       await tryViewportSet();
    //       resetMouse();
    //       doc = await fetch('/test/fixtures/no-IEDs-present.scd')
    //         .then(response => response.text())
    //         .then(str => new DOMParser().parseFromString(str, 'application/xml'));
    //       editor.docName = 'no-IEDS.scd';
    //       editor.docs[editor.docName] = doc;
    //       await editor.updateComplete;
    //       await plugin.updateComplete;
    //       await timeout(standardWait);
    //       await resetMouseState();
    //       await visualDiff(plugin, testName(this));
    //     });
    //     it('and shows no supervisions if not present', async function () {
    //       await timeout(standardWait);
    //       await resetMouseState();
    //       await visualDiff(plugin, testName(this));
    //     });
    //     it('and shows IEDs for selection', async function () {
    //       const iedFilter = plugin.shadowRoot!.querySelector('#iedFilter')!;
    //       await sendMouse({
    //         type: 'click',
    //         button: 'left',
    //         position: midEl(iedFilter!)
    //       });
    //       await plugin.updateComplete;
    //       const ied = iedFilter.querySelector(
    //         'mwc-radio-list-item[value="GOOSE_Subscriber1"]'
    //       );
    //       await sendMouse({
    //         type: 'click',
    //         button: 'left',
    //         position: midEl(ied!)
    //       });
    //       await timeout(standardWait);
    //       await resetMouseState();
    //       await visualDiff(plugin, testName(this));
    //     });
    //     it('for a change in IED', async function () {
    //       await changeIED(plugin, 'GOOSE_Subscriber1');
    //       await plugin.updateComplete;
    //       await timeout(standardWait);
    //       await visualDiff(plugin, testName(this));
    //     });
    //     it('cannot add existing supervisions if at maximum', async function () {
    //       await changeIED(plugin, 'GOOSE_Subscriber2');
    //       await timeout(standardWait);
    //       await resetMouseState();
    //       await visualDiff(plugin, testName(this));
    //     });
    //     it('for a change in supervision to LSVS shows supervisions', async function () {
    //       await changeIED(plugin, 'GOOSE_Subscriber1');
    //       await timeout(standardWait);
    //       await changeControlType(plugin);
    //       await resetMouseState();
    //       await visualDiff(plugin, testName(this));
    //     });
    //   });
    //   describe('changes supervisions', () => {
    //     beforeEach(async () => {
    //       localStorage.clear();
    //       await tryViewportSet();
    //       resetMouse();
    //       doc = await fetch('/test/fixtures/supervisions.scd')
    //         .then(response => response.text())
    //         .then(str => new DOMParser().parseFromString(str, 'application/xml'));
    //       editor.docName = 'supervisions.scd';
    //       editor.docs[editor.docName] = doc;
    //       await editor.updateComplete;
    //       await plugin.updateComplete;
    //     });
    //     afterEach(async () => {
    //       localStorage.clear();
    //     });
    //     it('can disconnect a used supervision', async function () {
    //       await changeIED(plugin, 'GOOSE_Subscriber1');
    //       await timeout(standardWait);
    //       const removeButton = plugin.shadowRoot!.querySelector(
    //         'section > .mlist.remover > mwc-list-item[data-ln="GOOSE_Subscriber1>>GOOSE_Supervision> LGOS 1"] > mwc-icon'
    //       );
    //       await sendMouse({
    //         type: 'click',
    //         button: 'left',
    //         position: midEl(removeButton!)
    //       });
    //       await timeout(standardWait);
    //       await resetMouseState();
    //       await visualDiff(plugin, testName(this));
    //     });
    //     it('can delete a used supervision', async function () {
    //       await changeIED(plugin, 'GOOSE_Subscriber1');
    //       await timeout(standardWait);
    //       const deleteButton = plugin.shadowRoot!.querySelector(
    //         'section > .mlist.remover > mwc-list-item[data-ln="GOOSE_Subscriber1>>GOOSE_Supervision> LGOS 2"] > mwc-icon'
    //       );
    //       await sendMouse({
    //         type: 'click',
    //         button: 'left',
    //         position: midEl(deleteButton!)
    //       });
    //       await timeout(standardWait);
    //       await resetMouseState();
    //       await visualDiff(plugin, testName(this));
    //     });
    //     it('can create a new supervision', async function () {
    //       await changeIED(plugin, 'GOOSE_Subscriber1');
    //       await timeout(standardWait);
    //       const createNewSupLn = plugin.shadowRoot!.querySelector(
    //         'section.unused mwc-icon-button#createNewLN'
    //       );
    //       await sendMouse({
    //         type: 'click',
    //         button: 'left',
    //         position: midEl(createNewSupLn!)
    //       });
    //       await timeout(standardWait);
    //       await resetMouseState();
    //       await visualDiff(plugin, testName(this));
    //     });
    //     it('can select an existing supervision', async function () {
    //       await changeIED(plugin, 'GOOSE_Subscriber4');
    //       await timeout(standardWait);
    //       const createNewSupLn = plugin.shadowRoot!.querySelector(
    //         'section.unused div.available-grouper > .filteredList > mwc-list > mwc-list-item[data-ln="GOOSE_Subscriber4>>GOOSE_Supervision> LGOS 2"]  '
    //       );
    //       await sendMouse({
    //         type: 'click',
    //         button: 'left',
    //         position: midEl(createNewSupLn!)
    //       });
    //       await timeout(standardWait * 2);
    //       await resetMouseState();
    //       await visualDiff(plugin, testName(this));
    //     });
    //     it('can select and assign an existing supervision', async function () {
    //       await changeIED(plugin, 'GOOSE_Subscriber4');
    //       await timeout(standardWait);
    //       const createNewSupLn = plugin.shadowRoot!.querySelector(
    //         'section.unused div.available-grouper > .filteredList > mwc-list > mwc-list-item[data-ln="GOOSE_Subscriber4>>GOOSE_Supervision> LGOS 2"]'
    //       );
    //       await sendMouse({
    //         type: 'click',
    //         button: 'left',
    //         position: midEl(createNewSupLn!)
    //       });
    //       await timeout(standardWait * 2);
    //       const existingCb = plugin.shadowRoot!.querySelector(
    //         'section.unused oscd-filtered-list#unusedControls > mwc-list-item[data-control="GOOSE_Publisher>>QB2_Disconnector>GOOSE2"]'
    //       );
    //       await sendMouse({
    //         type: 'click',
    //         button: 'left',
    //         position: midEl(existingCb!)
    //       });
    //       await timeout(standardWait);
    //       await resetMouseState();
    //       await visualDiff(plugin, testName(this));
    //     });
    //     it('can select and assign a new supervision', async function () {
    //       await changeIED(plugin, 'GOOSE_Subscriber4');
    //       await timeout(standardWait);
    //       const createNewSupLn = plugin.shadowRoot!.querySelector(
    //         'section.unused div.available-grouper > .filteredList > mwc-list > mwc-list-item[data-ln="NEW"]'
    //       );
    //       await sendMouse({
    //         type: 'click',
    //         button: 'left',
    //         position: midEl(createNewSupLn!)
    //       });
    //       await timeout(standardWait * 2);
    //       const existingCb = plugin.shadowRoot!.querySelector(
    //         'section.unused oscd-filtered-list#unusedControls > mwc-list-item[data-control="GOOSE_Publisher>>QB2_Disconnector>GOOSE2"]'
    //       );
    //       await sendMouse({
    //         type: 'click',
    //         button: 'left',
    //         position: midEl(existingCb!)
    //       });
    //       await timeout(standardWait);
    //       await resetMouseState();
    //       await visualDiff(plugin, testName(this));
    //     });
    //   });
  });
});
