'use strict';

// Test data: a scenario makes the objects it needs, and the steps delete them
// after it, whatever happens in it. An object is made through the model's add
// form, as the data administrator of the users registry, in a browser page of
// its own (the scenario's session is never touched); an object is deleted
// through its delete page. The objects a scenario adds through the forms on
// screen are deleted after it too: the admin's message after an add links the
// new object.
//
// No step makes or deletes an account: accounts are configuration.

const { Given, Then, After, AfterAll, BeforeStep, AfterStep } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const {
  budget,
  normal,
  listed,
  absolute,
  withoutQuery,
  adminReady,
  modelListUrl,
  dataClient,
  dataAdminHandle,
  findObjects,
  deleteObject,
  deleteObjectsNamed,
  cleansUp,
  afterScenario,
  setField,
  formErrors,
  closeClients,
} = require('./django-helpers');

/** Delete the object at an address after the scenario. */
function deleteAfter(world, url) {
  if (!cleansUp(world)) return;
  afterScenario(world, `object:${withoutQuery(url)}`, async () => { await deleteObject(world, url); });
}

/** Delete the objects of a model with a text after the scenario. */
function deleteNamedAfter(world, model, text) {
  if (!cleansUp(world)) return;
  afterScenario(world, `named:${normal(model)}|${normal(text)}`, async () => { await deleteObjectsNamed(world, model, text); });
}

/**
 * Make sure a model's list has no object with that text: delete it, as the
 * data administrator, when it is there (a run stopped half way can leave
 * one), and again after the scenario, whatever happens in it.
 *
 * Example #1: Given there is no "Data step question" in the "Questions" list
 * Example #2: Given there is no "Reviewers" in the "Groups" list
 * Example #3: And there is no "Delete test question" in the "Questions" list
 * Example #4: Given there is no "Test tag" in the "Tags" list
 * Example #5: And there is no "Inline test question" in the "Questions" list
 */
Given(/^there is no "([^"]*)" in the "([^"]*)" list$/, { timeout: 120000 }, async function (object, model) {
  if (normal(model) === 'users') {
    throw friendly({ message: 'The steps never delete an account.', hint: 'Accounts are configuration: the build of the site makes them, and a suite never creates or deletes one.' });
  }
  await deleteObjectsNamed(this, model, object);
  deleteNamedAfter(this, model, object);
});

/**
 * Make an object through its model's add form, as the data administrator, in
 * a browser page of its own, from a table of labels and values (see "I set
 * "…" to "…"" for the values each kind of field takes). An object of that
 * text that a stopped run left is deleted first; the new one is deleted after
 * the scenario.
 *
 * Example #1: Given there is a "Data step question" in the "Questions" list with:
 * Example #2: Given there is a "Test tag" in the "Tags" list with:
 * Example #3: And there is a "History test question" in the "Questions" list with:
 * Example #4: Given there is a "Reviewers" in the "Groups" list with:
 * Example #5: And there is a "Delete test question" in the "Questions" list with:
 */
Given(/^there is an? "([^"]*)" in the "([^"]*)" list with:$/, { timeout: 180000 }, async function (object, model, table) {
  if (normal(model) === 'users') {
    throw friendly({ message: 'The steps never create an account.', hint: 'Accounts are configuration: the build of the site makes them, and a suite never creates or deletes one.' });
  }
  await deleteObjectsNamed(this, model, object);
  deleteNamedAfter(this, model, object);
  const client = await dataClient(this);
  const list = await modelListUrl(this, model);
  const browser = this.playwrightBrowser;
  if (!browser) throw friendly({ message: 'The browser of the scenario is not open.', hint: 'The test-data steps open a page of their own in the browser of the scenario.' });
  const context = await browser.newContext({ ignoreHTTPSErrors: true, storageState: await client.context.storageState() });
  try {
    const page = await context.newPage();
    const own = { page, minWaitTime: this.minWaitTime, parameters: this.parameters, launchUrl: this.launchUrl };
    await page.goto(list + 'add/', { waitUntil: 'domcontentloaded' });
    await adminReady(page, budget(this));
    if (!(await page.locator('body.change-form').count())) {
      throw friendly({ message: `The add form of "${model}" did not open for the data administrator (${page.url()}).`, hint: `worldParameters.dataAdmin ("${dataAdminHandle(this)}") must be a superuser.` });
    }
    const form = page.locator('#content-main form').first();
    for (const [label, value] of table.raw()) await setField(own, form, label, value, `The add form of "${model}"`);
    await Promise.all([
      page.waitForNavigation({ timeout: budget(this), waitUntil: 'load' }).catch(() => {}),
      page.locator('.submit-row [name="_save"]').first().click(),
    ]);
    const errors = await formErrors(page);
    if (errors.length || (await page.locator('#content-main ul.errorlist li').count())) {
      const fields = await page.locator('#content-main ul.errorlist li').allTextContents().catch(() => []);
      throw friendly({ message: `The add form of "${model}" refused the test object "${object}": ${listed([...errors, ...fields])}.`, hint: 'Give the fields the form requires in the table of the step.' });
    }
    const link = page.locator('ul.messagelist li.success a').first();
    if (await link.count()) deleteAfter(this, absolute(this, await link.getAttribute('href')));
  } finally {
    await context.close().catch(() => {});
  }
  const made = await findObjects(this, model, object);
  if (!made.length) {
    throw friendly({ message: `After the add form was saved, the "${model}" list has no "${object}".`, hint: 'The object\'s text in the list is what its model shows for it (its __str__): make the table give the field that text.' });
  }
});

/**
 * Assert, as the data administrator, that a model's list has (or has no)
 * object with that text, whatever the account on screen may see.
 *
 * Example #1: Then there should be a "Data step question" in the "Questions" list
 * Example #2: Then there should be no "Delete test question" in the "Questions" list
 * Example #3: And there should be an "Inline test question" in the "Questions" list
 * Example #4: Then there should be no "Reviewers" in the "Groups" list
 * Example #5: And there should be a "Test tag" in the "Tags" list
 */
Then(/^there should be (a|an|no) "([^"]*)" in the "([^"]*)" list$/, { timeout: 60000 }, async function (article, object, model) {
  const urls = await findObjects(this, model, object);
  const want = article !== 'no';
  if ((urls.length > 0) !== want) {
    throw friendly({ message: want ? `The "${model}" list has no "${object}".` : `The "${model}" list has "${object}" (${urls.length}).`, hint: 'The step searches the list as the data administrator.' });
  }
  // An object the scenario made through a form, that the step now sees, is deleted after it.
  if (want) for (const url of urls) deleteAfter(this, url);
});

// ---------------------------------------------------------------------------
// The objects a scenario adds through the forms on screen
// ---------------------------------------------------------------------------

BeforeStep(function () {
  if (this.page) {
    try { this.__djangoBeforeUrl = this.page.url(); } catch { this.__djangoBeforeUrl = ''; }
  }
});

AfterStep(async function () {
  if (!this.page || !cleansUp(this)) return;
  let before;
  try { before = new URL(this.__djangoBeforeUrl || ''); } catch { return; }
  // A save from an add form: the admin's success message links the new object.
  if (!/\/add\/$/.test(before.pathname)) return;
  const links = await this.page.locator('ul.messagelist li.success a[href]').evaluateAll((as) => as.map((a) => a.getAttribute('href'))).catch(() => []);
  for (const href of links) {
    if (/\/add\/?$/.test(withoutQuery(href))) continue;
    deleteAfter(this, absolute(this, href));
  }
});

After({ timeout: 180000 }, async function (scope) {
  const todo = (this.__djangoCleanUp || []).slice().reverse();
  this.__djangoCleanUp = [];
  const failed = [];
  for (const item of todo) {
    try {
      await item.fn();
    } catch (err) {
      failed.push(`${item.label}: ${String((err && err.message) || err).split('\n')[0]}`);
    }
  }
  if (failed.length) {
    const status = scope && scope.result && scope.result.status;
    process.stderr.write(`\n[django-steps] The clean-up after "${scope && scope.pickle ? scope.pickle.name : 'the scenario'}" left: ${failed.join('; ')}${status ? ` (the scenario ${String(status).toLowerCase()})` : ''}\n`);
  }
});

AfterAll(async function () {
  await closeClients();
});
