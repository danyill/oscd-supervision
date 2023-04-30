/* eslint-disable func-names */
/* eslint-disable prefer-arrow-callback */

import { visualDiff } from '@web/test-runner-visual-regression';

import { setViewport, resetMouse } from '@web/test-runner-commands';
// sendMouse,

import { fixture, html } from '@open-wc/testing';

import '@openscd/open-scd-core/open-scd.js';

// import { test, expect } from '@playwright/test';

// import { getExtRefItem, getFcdaItem, midEl } from './test-support.js';

const factor = window.process && process.env.CI ? 4 : 2;

function timeout(ms: number) {
  return new Promise(res => {
    setTimeout(res, ms * factor);
  });
}

mocha.timeout(12000 * factor);

function testName(test: any, prefix: string): string {
  return test.test!.fullTitle().slice(prefix.length);
}

async function tryViewportSet(): Promise<void> {
  // target 1920x1080 screen-resolution, giving typical browser size of...
  await setViewport({ width: 1745, height: 845 });
}

const pluginName = 'oscd-supervision';

describe(pluginName, () => {
  let editor: any;
  let plugin: any;

  beforeEach(async function () {
    const plugins = {
      menu: [
        {
          name: 'Open File',
          translations: { de: 'Datei öffnen' },
          icon: 'folder_open',
          active: true,
          src: 'https://openscd.github.io/oscd-open/oscd-open.js',
        },
        {
          name: 'Save File',
          translations: { de: 'Datei speichern' },
          icon: 'save',
          active: true,
          src: 'https://openscd.github.io/oscd-save/oscd-save.js',
        },
      ],
      editor: [
        {
          name: 'Supervision',
          translations: { de: 'Überwachung', pt: 'Supervisão' },
          icon: 'ecg',
          active: true,
          src: '/dist/oscd-supervision.js',
        },
      ],
    };

    const ed = await fixture(
      html`<open-scd
        language="en"
        plugins="${JSON.stringify(plugins)}"
      ></open-scd>`
    );
    document.body.prepend(ed);
    // TODO remove once OpenSCD is exported as a Lit Element and updateComplete is available
    await timeout(1000);
    editor = document.querySelector('open-scd');
    plugin = document
      .querySelector('open-scd')!
      .shadowRoot!.querySelector(editor.editor);
  });

  afterEach(() => {
    editor.remove();
  });

  let doc: XMLDocument;

  describe('goose', () => {
    describe('shows supervisions', () => {
      beforeEach(async function () {
        localStorage.clear();
        await tryViewportSet();
        resetMouse();

        doc = await fetch('/test/fixtures/GOOSE-2007B4-LGOS.scd')
          .then(response => response.text())
          .then(str => new DOMParser().parseFromString(str, 'application/xml'));

        editor.docName = 'GOOSE-2007B4-LGOS.scd';
        editor.docs[editor.docName] = doc;
        // TODO remove once OpenSCD is exported as a Lit Element and updateComplete is available
        await timeout(500);
        await editor.updateComplete;
      });

      it('shows the first IED by default', async function () {
        plugin.requestUpdate();
        await plugin.updateComplete;

        await timeout(1000);
        await visualDiff(plugin, testName(this, pluginName));
      });
    });
  });
});
