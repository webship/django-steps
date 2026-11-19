'use strict';

// The admin around the forms and lists: the index with its apps and models and
// what an account may do with each, the recent actions, the breadcrumbs, the
// navigation sidebar, the colour theme, the lists opened by a model's name, and
// the pages an account is refused.

const { Given, When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const {
  budget,
  clean,
  normal,
  listed,
  escapeRegExp,
  adminUrl,
  absolute,
  hintFor,
  open,
  afterNavigation,
  pageSummary,
  eventually,
  modelListUrl,
} = require('./django-helpers');

/** Open the admin index unless the page already is it. */
async function onIndex(world) {
  if (!(await world.page.locator('body.dashboard').count())) await open(world, adminUrl(world));
  if (!(await world.page.locator('body.dashboard').count())) {
    throw friendly({ message: `The admin index did not open: ${await pageSummary(world)}.`, hint: hintFor(world, 'Log in first: Given I am a logged in user with the "editor" user') });
  }
}

/** The apps and models the admin index shows, with the links of each model. */
async function indexModels(page) {
  return page.evaluate(() => [...document.querySelectorAll('#content-main [class^="app-"].module, #content-main .module[class*=" app-"]')].map((m) => ({
    app: (m.querySelector('caption') || {}).textContent ? m.querySelector('caption').textContent.replace(/\s+/g, ' ').trim() : '',
    models: [...m.querySelectorAll('tr[class^="model-"], tr[class*=" model-"]')].map((tr) => ({
      name: (tr.querySelector('th') || {}).textContent ? tr.querySelector('th').textContent.replace(/\s+/g, ' ').trim() : '',
      add: !!tr.querySelector('a.addlink'),
      change: !!tr.querySelector('a.changelink'),
      view: !!tr.querySelector('a.viewlink'),
    })),
  })));
}

/**
 * Open the admin index (the site administration page), or be on it.
 *
 * Example #1: Given I am on the admin index
 * Example #2: When I open the admin index
 * Example #3: Given we are on the admin index
 * Example #4: And I open the admin index
 * Example #5: When we open the admin index
 */
Given(/^(?:I am on|we are on|(?:I |we )?open) the admin index$/, async function () {
  await open(this, adminUrl(this));
});

/**
 * Assert that the admin index lists (or does not list) an app, by its name as
 * the index shows it. An account sees only the apps it has a permission in.
 *
 * Example #1: Then the admin index should list the app "Polls"
 * Example #2: Then the admin index should not list the app "Authentication and Authorization"
 * Example #3: And the admin index should list the app "Authentication and Authorization"
 * Example #4: Then the admin index should list the app "Polls"
 * Example #5: And the admin index should not list the app "Polls"
 */
Then(/^the admin index should( not)* list the app "([^"]*)"$/, async function (notCase, app) {
  await onIndex(this);
  const apps = (await indexModels(this.page)).map((a) => a.app);
  const listedApp = apps.some((a) => normal(a) === normal(app));
  if (listedApp === !!notCase) {
    throw friendly({
      message: notCase ? `The admin index lists the app "${app}".` : `The admin index does not list the app "${app}". It lists: ${listed(apps)}.`,
      hint: 'The index lists the apps in which the account has at least one permission.',
    });
  }
});

/**
 * Assert that an app of the admin index lists (or does not list) a model, by
 * the model's plural name as the index shows it.
 *
 * Example #1: Then the app "Polls" should list the model "Questions"
 * Example #2: Then the app "Authentication and Authorization" should list the model "Users"
 * Example #3: And the app "Polls" should list the model "Tags"
 * Example #4: Then the app "Polls" should not list the model "Choices"
 * Example #5: And the app "Authentication and Authorization" should not list the model "Questions"
 */
Then(/^the app "([^"]*)" should( not)* list the model "([^"]*)"$/, async function (app, notCase, model) {
  await onIndex(this);
  const apps = await indexModels(this.page);
  const entry = apps.find((a) => normal(a.app) === normal(app));
  if (!entry) {
    throw friendly({ message: `The admin index does not list the app "${app}". It lists: ${listed(apps.map((a) => a.app))}.`, hint: 'Write the app as the index shows it, such as "Polls".' });
  }
  const has = entry.models.some((m) => normal(m.name) === normal(model));
  if (has === !!notCase) {
    throw friendly({
      message: notCase ? `The app "${app}" lists the model "${model}".` : `The app "${app}" does not list the model "${model}". It lists: ${listed(entry.models.map((m) => m.name))}.`,
      hint: 'A model is listed when the admin registers it and the account has a permission on it.',
    });
  }
});

/**
 * Assert what the account may do with a model, as the admin index shows it:
 * "add" (the "Add" link), "change" (the "Change" link) or "view" (the "View"
 * link, or "Change", which includes viewing).
 *
 * Example #1: Then I should be able to add "Questions"
 * Example #2: Then I should not be able to add "Questions"
 * Example #3: And we should be able to change "Tags"
 * Example #4: Then I should not be able to change "Categories"
 * Example #5: And I should be able to view "Questions"
 */
Then(/^(I |we )*should( not)* be able to (add|change|view) "([^"]*)"$/, async function (pronounCase, notCase, what, model) {
  await onIndex(this);
  const apps = await indexModels(this.page);
  const rows = apps.flatMap((a) => a.models.map((m) => ({ ...m, app: a.app }))).filter((m) => normal(m.name) === normal(model));
  const can = rows.some((m) => (what === 'add' ? m.add : what === 'change' ? m.change : m.view || m.change));
  if (can === !!notCase) {
    const offered = rows.length ? rows.map((m) => [m.add && 'add', m.change && 'change', m.view && 'view'].filter(Boolean).join(', ') || 'nothing').join('; ') : null;
    throw friendly({
      message: notCase
        ? `The admin index offers to ${what} "${model}".`
        : (rows.length ? `The admin index does not offer to ${what} "${model}": it offers ${offered}.` : `The admin index does not list "${model}" for this account.`),
      hint: 'The index shows "Add", "Change" or "View" by the permissions of the account that is logged in.',
    });
  }
});

/**
 * Open the list of a model (its change list), by the model's plural name as
 * the admin index shows it; with "of", the app's name too, when two apps have
 * a model of that name.
 *
 * Example #1: When I open the "Questions" list
 * Example #2: Given I am on the "Users" list
 * Example #3: When we open the "Tags" list of "Polls"
 * Example #4: Given we are on the "Questions" list
 * Example #5: And I open the "Groups" list
 */
Given(/^(?:I am on|we are on|(?:I |we )?open) the "([^"]*)" list(?: of "([^"]*)")?$/, async function (model, app) {
  const url = await modelListUrl(this, model, app);
  const response = await open(this, url);
  if (response && response.status() >= 400) {
    throw friendly({
      message: `The "${model}" list answered with HTTP ${response.status()}: ${await pageSummary(this)}.`,
      hint: 'The account that is logged in may not see this list: check its permissions, or log in as another account.',
    });
  }
});

/**
 * Assert that the page is the list of a model: the admin's change list, with
 * the model's name at the end of its breadcrumbs.
 *
 * Example #1: Then I should be on the "Questions" list
 * Example #2: Then we should be on the "Users" list
 * Example #3: And I should be on the "Tags" list
 * Example #4: Then I should be on the "Categories" list
 * Example #5: And we should be on the "Questions" list
 */
Then(/^(I |we )*should be on the "([^"]*)" list$/, async function (pronounCase, model) {
  const page = this.page;
  const read = async () => ({
    list: (await page.locator('body.change-list').count()) > 0,
    crumb: clean(await page.locator('.breadcrumbs').first().evaluate((b) => {
      const last = b.querySelector('[aria-current="page"]');
      if (last) return last.textContent;
      return (b.textContent.split('›').pop() || '');
    }).catch(() => '')),
  });
  await eventually(this, read, (v) => v.list && normal(v.crumb) === normal(model), async (v) => ({
    message: v.list ? `The page is the "${v.crumb}" list, not the "${model}" list.` : `The page is not a list of the admin: ${await pageSummary(this)}.`,
    hint: hintFor(this, `Open it with: When I open the "${model}" list`),
  }));
});

/**
 * Assert that the recent actions of the admin index ("My actions") list (or
 * do not list) an object; "as added", "as changed" or "as deleted" says what
 * the account did with it.
 *
 * Example #1: Then my recent actions should list "Recent action question"
 * Example #2: Then my recent actions should list "Recent action question" as added
 * Example #3: And my recent actions should list "Recent action question" as deleted
 * Example #4: Then my recent actions should not list "Recent action question"
 * Example #5: And my recent actions should list "Recent action question" as changed
 */
Then(/^my recent actions should( not)* list "([^"]*)"(?: as (added|changed|deleted))?$/, async function (notCase, object, kind) {
  await onIndex(this);
  const entries = await this.page.evaluate(() => [...document.querySelectorAll('#recent-actions-module ul.actionlist li')].map((li) => {
    const kind = li.classList.contains('addlink') ? 'added' : li.classList.contains('deletelink') ? 'deleted' : li.classList.contains('changelink') ? 'changed' : '';
    const hidden = li.querySelector('.visually-hidden');
    const type = li.querySelector('.mini');
    let text = li.textContent;
    if (hidden) text = text.replace(hidden.textContent, '');
    if (type) text = text.replace(type.textContent, '');
    return { kind, object: text.replace(/\s+/g, ' ').trim() };
  }));
  const hit = entries.some((e) => normal(e.object) === normal(object) && (!kind || e.kind === kind));
  if (hit === !!notCase) {
    throw friendly({
      message: notCase
        ? `My recent actions list "${object}"${kind ? ` as ${kind}` : ''}.`
        : `My recent actions do not list "${object}"${kind ? ` as ${kind}` : ''}. They list: ${listed(entries.map((e) => `${e.object} (${e.kind})`))}.`,
      hint: 'The admin index lists the last ten actions of the account that is logged in, newest first.',
    });
  }
});

/**
 * Assert the breadcrumbs of an admin page, from "Home" to the page: the
 * crumbs separated by "›" (or ">").
 *
 * Example #1: Then the breadcrumbs should read "Home › Polls › Questions"
 * Example #2: Then the breadcrumbs should read "Home › Polls › Questions › Add question"
 * Example #3: And the breadcrumbs should read "Home > Authentication and Authorization > Users"
 * Example #4: Then the breadcrumbs should read "Home › Polls"
 * Example #5: And the breadcrumbs should read "Home › Change password"
 */
Then(/^the breadcrumbs should read "([^"]*)"$/, async function (expected) {
  const page = this.page;
  const read = async () => page.locator('.breadcrumbs').first().evaluate((b) => {
    const items = b.querySelectorAll('li');
    if (items.length) return [...items].map((li) => li.textContent.replace(/\s+/g, ' ').trim());
    return b.textContent.split('›').map((t) => t.replace(/\s+/g, ' ').trim());
  }).catch(() => []);
  const want = expected.split(/\s*[›>]\s*/).map(normal);
  await eventually(this, read, (crumbs) => crumbs.length === want.length && crumbs.every((c, i) => normal(c) === want[i]),
    async (crumbs) => ({ message: `The breadcrumbs read ${crumbs.length ? `"${crumbs.join(' › ')}"` : '(none)'}, not "${expected}": ${await pageSummary(this)}.`, hint: 'Write every crumb from "Home", separated by "›" or ">".' }), 3000);
});

/**
 * Follow a crumb of the breadcrumbs, by its text.
 *
 * Example #1: When I follow "Polls" in the breadcrumbs
 * Example #2: When I follow "Home" in the breadcrumbs
 * Example #3: And we follow "Questions" in the breadcrumbs
 * Example #4: When we follow "Authentication and Authorization" in the breadcrumbs
 * Example #5: And I follow "Users" in the breadcrumbs
 */
When(/^(I |we )*follow "([^"]*)" in the breadcrumbs$/, async function (pronounCase, crumb) {
  const page = this.page;
  const link = page.locator('.breadcrumbs a').filter({ hasText: new RegExp('^\\s*' + escapeRegExp(clean(crumb)) + '\\s*$') });
  if (!(await link.count())) {
    const crumbs = await page.locator('.breadcrumbs a').allTextContents().catch(() => []);
    throw friendly({ message: `The breadcrumbs have no link "${crumb}". Their links: ${listed(crumbs)}.`, hint: 'The last crumb is the page itself and is no link.' });
  }
  await afterNavigation(this, () => link.first().click());
});

/**
 * Filter the navigation sidebar of the admin's pages (the box "Start typing to
 * filter…"): it shows only the models whose name has the text.
 *
 * Example #1: When I filter the navigation sidebar with "quest"
 * Example #2: When we filter the navigation sidebar with "user"
 * Example #3: And I filter the navigation sidebar with "Tag"
 * Example #4: When I filter the navigation sidebar with ""
 * Example #5: And we filter the navigation sidebar with "no such model"
 */
When(/^(I |we )*filter the navigation sidebar with "([^"]*)"$/, async function (pronounCase, text) {
  const page = this.page;
  const box = page.locator('#nav-filter');
  if (!(await box.count())) {
    throw friendly({ message: `The page has no navigation sidebar: ${await pageSummary(this)}.`, hint: 'The admin draws the sidebar on its pages other than the index and the login page, when the site keeps it on (admin.site.enable_nav_sidebar).' });
  }
  await box.fill(text || '');
});

/**
 * Assert that the navigation sidebar shows (or does not show) a model, by its
 * plural name: after a filter, only the models whose name has the text show.
 *
 * Example #1: Then the navigation sidebar should show "Questions"
 * Example #2: Then the navigation sidebar should not show "Tags"
 * Example #3: And the navigation sidebar should show "Users"
 * Example #4: Then the navigation sidebar should not show "Groups"
 * Example #5: And the navigation sidebar should show "Categories"
 */
Then(/^the navigation sidebar should( not)* show "([^"]*)"$/, async function (notCase, model) {
  const page = this.page;
  const read = () => page.evaluate(() => [...document.querySelectorAll('#nav-sidebar tr[class^="model-"], #nav-sidebar tr[class*=" model-"]')]
    .filter((tr) => getComputedStyle(tr).display !== 'none')
    .map((tr) => (tr.querySelector('th') || tr).textContent.replace(/\s+/g, ' ').trim())).catch(() => []);
  await eventually(this, read, (shown) => shown.some((m) => normal(m) === normal(model)) === !notCase,
    async (shown) => ({ message: notCase ? `The navigation sidebar shows "${model}".` : `The navigation sidebar does not show "${model}". It shows: ${listed(shown)}.`, hint: hintFor(this, 'The sidebar shows the models the account may see; its filter hides the others.') }), 3000);
});

/**
 * Open the list of a model from the navigation sidebar, by its plural name.
 *
 * Example #1: When I open "Tags" from the navigation sidebar
 * Example #2: When we open "Questions" from the navigation sidebar
 * Example #3: And I open "Users" from the navigation sidebar
 * Example #4: When I open "Categories" from the navigation sidebar
 * Example #5: And we open "Groups" from the navigation sidebar
 */
When(/^(I |we )*open "([^"]*)" from the navigation sidebar$/, async function (pronounCase, model) {
  const page = this.page;
  const link = page.locator('#nav-sidebar tr[class*="model-"] th a').filter({ hasText: new RegExp('^\\s*' + escapeRegExp(clean(model)) + '\\s*$', 'i') });
  if (!(await link.count())) {
    const shown = await page.locator('#nav-sidebar tr[class*="model-"] th').allTextContents().catch(() => []);
    throw friendly({ message: `The navigation sidebar has no "${model}". It has: ${listed(shown)}.`, hint: hintFor(this, 'The sidebar is on the admin\'s pages other than the index.') });
  }
  await afterNavigation(this, () => link.first().click());
});

/**
 * Switch the admin's colour theme with the theme button of its header, to
 * "light", "dark" or "auto" (the browser's own choice). The admin keeps the
 * choice for the next pages.
 *
 * Example #1: When I switch the admin theme to "dark"
 * Example #2: When I switch the admin theme to "light"
 * Example #3: And we switch the admin theme to "auto"
 * Example #4: When we switch the admin theme to "dark"
 * Example #5: And I switch the admin theme to "light"
 */
When(/^(I |we )*switch the admin theme to "(light|dark|auto)"$/, async function (pronounCase, theme) {
  const page = this.page;
  const button = page.locator('#header button.theme-toggle, header button.theme-toggle').first();
  if (!(await button.count())) {
    throw friendly({ message: `The page has no theme button: ${await pageSummary(this)}.`, hint: 'The admin draws the theme button in its header on every page.' });
  }
  for (let i = 0; i < 3; i += 1) {
    const now = await page.evaluate(() => document.documentElement.dataset.theme || 'auto');
    if (now === theme) return;
    await button.click();
  }
  const now = await page.evaluate(() => document.documentElement.dataset.theme || 'auto');
  if (now !== theme) {
    throw friendly({ message: `The theme button went round its three themes without "${theme}": the theme is "${now}".`, hint: 'The button cycles through auto, dark and light.' });
  }
});

/**
 * Assert the admin's colour theme: "light", "dark" or "auto".
 *
 * Example #1: Then the admin theme should be "dark"
 * Example #2: Then the admin theme should be "light"
 * Example #3: And the admin theme should be "auto"
 * Example #4: Then the admin theme should be "auto"
 * Example #5: And the admin theme should be "dark"
 */
Then(/^the admin theme should be "(light|dark|auto)"$/, async function (theme) {
  const page = this.page;
  await eventually(this, () => page.evaluate(() => document.documentElement.dataset.theme || 'auto'), (now) => now === theme,
    (now) => ({ message: `The admin theme is "${now}", not "${theme}".`, hint: 'Switch it with: When I switch the admin theme to "dark"' }), 3000);
});

/**
 * Assert that the account that is logged in may (or may not) open an address
 * of the site: a refused page answers 403 (or sends a visitor to the login
 * page); an allowed one is the page itself.
 *
 * Example #1: Then I should not be allowed to open "/admin/auth/user/"
 * Example #2: Then I should be allowed to open "/admin/polls/question/"
 * Example #3: And we should not be allowed to open "/admin/polls/question/add/"
 * Example #4: Then I should be allowed to open "/admin/"
 * Example #5: And I should not be allowed to open "/admin/auth/group/"
 */
Then(/^(I |we )*should( not)* be allowed to open "([^"]*)"$/, async function (pronounCase, notCase, path) {
  const response = await open(this, absolute(this, path));
  const status = response ? response.status() : 0;
  const login = (await this.page.locator('#login-form').count()) > 0 && !String(path).match(/login/);
  const allowed = status > 0 && status < 400 && !login;
  if (allowed === !!notCase) {
    throw friendly({
      message: notCase
        ? `The site opened "${path}" (HTTP ${status}): ${await pageSummary(this)}.`
        : `The site refused "${path}" (HTTP ${status}${login ? ', the login page' : ''}): ${await pageSummary(this)}.`,
      hint: hintFor(this, 'The admin answers 403 when the account lacks the permission, and sends a visitor to its login page.'),
    });
  }
});

module.exports = { indexModels, onIndex, budget };
