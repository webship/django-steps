'use strict';

// Shared plumbing of the admin steps: addresses, the request the browser cut,
// opening a page and waiting for the admin's own scripts, messages, the users
// registry and the session cache, the form fields found by their labels, the
// change list, the inline rows, and the test-data client that makes and
// deletes the test objects as the data administrator of the users registry.
//
// This file registers no step. The admin draws its pages on the server: an
// action is a page load, and the few widgets that work in the browser (the
// autocomplete field, the two-list selector, the date shortcuts, the inline
// rows, the collapsible sections) are set up by the admin's scripts once the
// page has loaded. The steps wait for that load and for the answer of the
// request a widget sends, never for a fixed time.

const { gotoUrl, friendly } = require('webship-js/tests/step-definitions/webship');

// ---------------------------------------------------------------------------
// Budgets and text
// ---------------------------------------------------------------------------

/** The per-assertion wait budget: `minWaitTime.page` from cucumber.js, at least 10 seconds. */
function budget(world) {
  return Math.max((world && world.minWaitTime && world.minWaitTime.page) || 0, 10000);
}

/** White space collapsed and trimmed; the invisible marks some texts carry removed. */
function clean(text) {
  return String(text === null || text === undefined ? '' : text).replace(/[­​-‏‪-‮⁠﻿]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * A text as a comparison sees it: cleaned, in lower case, the typographic
 * quotes and apostrophes (“ ” ‘ ’, which the admin writes in its messages)
 * the same as the straight ones, and a label's closing colon dropped.
 */
function normal(text) {
  return clean(text).replace(/[“”„"]/g, '"').replace(/[‘’‚']/g, "'").replace(/["']/g, "'").replace(/\s*:$/, '').toLowerCase();
}

/** Whether a text contains another, as `normal` reads them. */
function mentions(text, part) {
  return normal(text).includes(normal(part));
}

/** A list for an error message: `"a", "b", "c"` or `(none)`. */
function listed(values) {
  const items = [...new Set((values || []).map(clean).filter(Boolean))];
  return items.length ? items.map((item) => `"${item}"`).join(', ') : '(none)';
}

/** Escape a literal string for use in a RegExp. */
function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The entities the server writes in a page, decoded. */
function decodeEntities(text) {
  return String(text)
    .replace(/&#x([0-9a-f]+);/gi, (m, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (m, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

/** The text of an HTML fragment: tags dropped, entities decoded. */
function htmlText(html) {
  return clean(decodeEntities(String(html).replace(/<[^>]*>/g, ' ')));
}

// ---------------------------------------------------------------------------
// Addresses
// ---------------------------------------------------------------------------

/** The site root without a trailing slash. */
function siteRoot(world) {
  return String(world.launchUrl || (world.parameters && world.parameters.launchUrl) || '').replace(/\/+$/, '');
}

/** The path of the admin (`worldParameters.adminPath`, /admin/ by default), with its slashes. */
function adminPath(world) {
  const value = String((world.parameters && world.parameters.adminPath) || '/admin/').trim();
  return '/' + value.replace(/^\/+|\/+$/g, '') + '/';
}

/** An address under the admin: `adminUrl(world, 'login/')`. */
function adminUrl(world, rel = '') {
  return siteRoot(world) + adminPath(world) + String(rel).replace(/^\/+/, '');
}

/** An address of the site from a path the page or a step gave (absolute URLs stay as they are). */
function absolute(world, href) {
  if (/^https?:\/\//.test(href)) return href;
  return siteRoot(world) + (String(href).startsWith('/') ? '' : '/') + href;
}

/** A path or an address without its query string. */
function withoutQuery(href) {
  return String(href).split('?')[0].split('#')[0];
}

// ---------------------------------------------------------------------------
// The request the browser cut, opening a page, waiting
// ---------------------------------------------------------------------------

/**
 * Whether the browser shows its own error page instead of the site's answer:
 * Chromium aborts every request in flight when the network of the machine
 * changes (a container starting or stopping on it) and shows
 * chrome-error://chromewebdata/. Returns a sentence for an error message, or ''.
 */
function cutRequest(world) {
  const url = String((world.page && world.page.url()) || '');
  if (url.startsWith('chrome-error://')) {
    return `the browser shows its own error page (${url}): the request was cut before the site answered`;
  }
  return '';
}

/** The hint of a failure where the browser cut the request. */
const CUT_HINT = 'The browser cut the request (a network change on the machine, such as a container starting); nothing is wrong with the scenario. Run it again. On a shared machine, run the suite in the project\'s container (cmd-tools-testing.sh <project> --run in the Webship Workspace), where the network of the host does not reach.';

/** The hint for a failure: the cut request's when the browser cut it, else the one given. */
function hintFor(world, hint) {
  return cutRequest(world) ? CUT_HINT : hint;
}

/**
 * Wait until the admin page is ready to use: the document has loaded (the
 * admin's scripts set the widgets up on the load event: the date shortcuts,
 * the two-list selectors, the inline rows' links) and the autocomplete fields
 * are drawn.
 */
async function adminReady(page, timeout) {
  await page.waitForLoadState('load', { timeout }).catch(() => {});
  await page.waitForFunction(() => {
    if (document.readyState !== 'complete') return false;
    // An autocomplete field (select2) is ready once its box is drawn next to it.
    for (const select of document.querySelectorAll('select.admin-autocomplete')) {
      if (select.closest('.empty-form')) continue;
      if (!select.classList.contains('select2-hidden-accessible')) return false;
    }
    // A two-list selector is ready once its "available" list is drawn.
    for (const select of document.querySelectorAll('select.selectfilter, select.selectfilterstacked')) {
      if (select.closest('.empty-form')) continue;
      if (!document.getElementById(select.id + '_from')) return false;
    }
    return true;
  }, null, { timeout }).catch(() => {});
}

/**
 * Open a URL and wait for the admin page to be ready. A network change on the
 * machine aborts a navigation once now and then (ERR_NETWORK_CHANGED, or the
 * browser's own error page): the step goes again, once.
 *
 * @returns {Promise<import('playwright').Response|null>} the answer of the server, when the browser gives it.
 */
async function open(world, url) {
  const page = world.page;
  const go = () => page.goto(url, { waitUntil: 'domcontentloaded' });
  let response = null;
  try {
    response = await go();
  } catch (err) {
    if (/ERR_NETWORK_CHANGED|chrome-error:\/\/chromewebdata|ERR_ABORTED/.test(String(err && err.message))) {
      await page.waitForTimeout(500);
      response = await go();
    } else {
      // webship-js's own words for a refused connection or an unknown host.
      await gotoUrl(page, url);
    }
  }
  if (cutRequest(world)) {
    await page.waitForTimeout(500);
    response = await go().catch(() => null);
  }
  await adminReady(page, budget(world));
  return response;
}

/**
 * Run an action that sends a form or follows a link, and wait for the new
 * page: the browser leaves the page it was on and the new one is ready. When
 * a network change on the machine cut the request (the browser shows its own
 * error page), the step fails and says so, unless `cut: 'return'` asks the
 * caller to decide (a login is sent again).
 */
async function afterNavigation(world, fn, { cut = 'fail' } = {}) {
  const page = world.page;
  await Promise.all([
    page.waitForNavigation({ timeout: budget(world), waitUntil: 'load' }).catch(() => {}),
    fn(),
  ]);
  await adminReady(page, budget(world));
  if (cut === 'fail' && cutRequest(world)) {
    throw friendly({ message: `The page did not load: ${cutRequest(world)}.`, hint: CUT_HINT });
  }
}

/** The main heading of the page, as a person reads it. */
async function heading(page) {
  return clean(await page.locator('#content h1, h1').first().innerText({ timeout: 2000 }).catch(() => ''));
}

/** What the page on screen says about itself, for an error message. */
async function pageSummary(world) {
  const cut = cutRequest(world);
  if (cut) return cut;
  const page = world.page;
  const title = clean(await page.title().catch(() => ''));
  const h1 = await heading(page);
  return `the page shows "${h1 || '(no heading)'}" (title "${title}") at ${page.url()}`;
}

/** Poll a reading until it satisfies a check, or fail with the last reading. */
async function eventually(world, read, check, explain, timeout) {
  const deadline = Date.now() + (timeout || budget(world));
  let value;
  for (;;) {
    value = await read();
    if (check(value)) return value;
    if (Date.now() > deadline) throw friendly(await explain(value));
    await world.page.waitForTimeout(150);
  }
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

/** The messages the admin shows (`ul.messagelist`), of one kind or all: success, warning, error, info. */
async function messages(page, kind) {
  const selector = kind && kind !== 'any' ? `ul.messagelist li.${kind}` : 'ul.messagelist li';
  return (await page.locator(selector).allTextContents().catch(() => [])).map(clean).filter(Boolean);
}

/** The error note above a form ("Please correct the errors below.") and the errors of the whole form. */
async function formErrors(page) {
  const note = (await page.locator('#content .errornote').allTextContents().catch(() => [])).map(clean);
  const general = (await page.locator('#content form ul.errorlist.nonfield li, #content form > div > ul.errorlist li').allTextContents().catch(() => [])).map(clean);
  return [...note, ...general].filter(Boolean);
}

// ---------------------------------------------------------------------------
// Accounts and sessions
// ---------------------------------------------------------------------------

/**
 * An account of the users registry in cucumber.js (`worldParameters.users`),
 * by the handle a scenario names it with.
 *
 * @returns {{handle: string, username: string, password: string, email: (string|undefined)}}
 */
function resolveUser(world, handle) {
  const users = (world.parameters && world.parameters.users) || {};
  const entry = users[handle];
  if (!entry) {
    throw friendly({
      message: `The user "${handle}" is not in the users registry. Known users: ${Object.keys(users).join(', ') || '(none)'}.`,
      hint: `Add it to worldParameters.users in cucumber.js: users: { ${handle}: { username: '${handle}', password: process.env.${String(handle).toUpperCase()}_PASSWORD } }. The account itself is made once by the build of the site, never by a feature.`,
    });
  }
  if (!entry.username || !entry.password) {
    throw friendly({
      message: `The user "${handle}" has no ${entry.username ? 'password' : 'user name'} in the users registry.`,
      hint: `Set worldParameters.users.${handle}.username and .password in cucumber.js, from environment variables.`,
    });
  }
  return { handle, username: entry.username, password: entry.password, email: entry.email };
}

/** A handle of the users registry stands for its user name; anything else is a user name. */
function userName(world, who) {
  const users = (world.parameters && world.parameters.users) || {};
  return users[who] ? resolveUser(world, who).username : who;
}

// The sessions of the accounts that logged in during this run, by site and
// account: the cookies of the browser after a login through the form.
const SESSIONS = new Map();

function sessionKey(world, username) {
  return `${siteRoot(world)}|${String(username).toLowerCase()}`;
}

function reuseSessions(world) {
  return !(world.parameters && world.parameters.reuseSessions === false);
}

/** The name the admin greets the signed-in account with ("Welcome, editor."), or null. */
async function signedInName(page) {
  if (!(await page.locator('#logout-form, #user-tools').count().catch(() => 0))) return null;
  const name = await page.locator('#user-tools strong').first().textContent({ timeout: 2000 }).catch(() => ''); // textContent: the admin's CSS writes the name in capitals
  return clean(name) || null;
}

const LOGIN_HINT = 'The admin login page has the fields "Username" and "Password" and the button "Log in". Check launchUrl and adminPath in cucumber.js, and that the account is staff (only staff accounts may log in to the admin).';

/**
 * Fill in and send the admin login form, then read its outcome: the name the
 * next page greets, or the error the login page shows.
 *
 * @returns {Promise<{name: (string|null), errors: string[], cut: boolean}>}
 */
async function submitLogin(world, username, password, again = true) {
  const page = world.page;
  await page.context().clearCookies();
  world.__djangoSession = null;
  await open(world, adminUrl(world, 'login/?next=' + encodeURIComponent(adminPath(world))));
  try {
    await page.locator('#login-form input[name="username"]').waitFor({ state: 'visible', timeout: budget(world) });
  } catch (err) {
    throw friendly({ message: `The admin login form did not appear: ${await pageSummary(world)}.`, cause: err, hint: hintFor(world, LOGIN_HINT) });
  }
  await page.locator('#login-form input[name="username"]').fill(username);
  await page.locator('#login-form input[name="password"]').fill(password);
  await afterNavigation(world, () => page.locator('#login-form [type="submit"]').first().click(), { cut: 'return' });
  if (cutRequest(world)) {
    // A network change on the machine cut the request: a login can be sent again, once.
    if (again) return submitLogin(world, username, password, false);
    return { name: null, errors: [cutRequest(world)], cut: true };
  }
  const name = await signedInName(page);
  const errors = name ? [] : await formErrors(page);
  return { name, errors, cut: false };
}

/** Take over the session an account opened earlier in this run. */
async function restoreSession(world, user) {
  const key = sessionKey(world, user.username);
  const cookies = SESSIONS.get(key);
  if (!cookies || !reuseSessions(world)) return false;
  const context = world.page.context();
  await context.clearCookies();
  await context.addCookies(cookies);
  await open(world, adminUrl(world));
  const name = await signedInName(world.page);
  if (name && name.toLowerCase() === user.username.toLowerCase()) {
    world.__djangoSession = key;
    world.__djangoUser = user;
    return true;
  }
  SESSIONS.delete(key);
  await context.clearCookies();
  return false;
}

/**
 * Log in as an account of the users registry, by its handle: take over its
 * session when it has one from earlier in the run, else log in through the
 * form and keep the session for the next scenario.
 */
async function logInAs(world, handle) {
  const user = resolveUser(world, handle);
  if (await restoreSession(world, user)) return user;
  const outcome = await submitLogin(world, user.username, user.password);
  if (!outcome.name) {
    throw friendly({
      message: `Could not log in to the admin as "${handle}" (${user.username}): ${listed(outcome.errors)}.`,
      hint: outcome.cut ? CUT_HINT : 'Check the user name and the password of the account in worldParameters.users, and that the build of the site made it a staff account.',
    });
  }
  world.__djangoUser = user;
  if (reuseSessions(world)) {
    const key = sessionKey(world, user.username);
    SESSIONS.set(key, await world.page.context().cookies());
    world.__djangoSession = key;
  }
  return user;
}

/** Forget the session of the browser in the session cache (it ended), or every session of an account. */
function forgetSession(world, username) {
  if (username) SESSIONS.delete(sessionKey(world, username));
  if (world.__djangoSession) SESSIONS.delete(world.__djangoSession);
  world.__djangoSession = null;
}

/** The account of the registry this scenario logged in as, or a failure that says to log in first. */
function currentUser(world) {
  if (world.__djangoUser) return world.__djangoUser;
  throw friendly({
    message: 'No account of the users registry is logged in in this scenario.',
    hint: 'Log in first: Given I am a logged in user with the "editor" user',
  });
}

// ---------------------------------------------------------------------------
// The models of the admin
// ---------------------------------------------------------------------------

// The address of each model's list, by site, app and plural name, as the
// admin index lists them: read once per run.
const MODEL_URLS = new Map();

/**
 * The models of an admin index page: app name, model name and the address of
 * its list (the admin draws the same index for every release line).
 *
 * @param {string} html
 * @returns {Array<{app: string, model: string, href: string, add: (string|null)}>}
 */
function modelsOfIndex(html) {
  const found = [];
  const blocks = String(html).split(/<div class="app-/).slice(1);
  for (const block of blocks) {
    const caption = block.match(/<caption>\s*<a [^>]*>([\s\S]*?)<\/a>/);
    const app = caption ? htmlText(caption[1]) : '';
    const rows = block.match(/<tr class="model-[^"]*">[\s\S]*?<\/tr>/g) || [];
    for (const row of rows) {
      const link = row.match(/<th scope="row"[^>]*>\s*<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
      if (!link) continue;
      const add = row.match(/<a href="([^"]+)"[^>]*class="addlink"/);
      found.push({ app, model: htmlText(link[2]), href: decodeEntities(link[1]), add: add ? decodeEntities(add[1]) : null });
    }
  }
  return found;
}

/**
 * The address of a model's list, by the model's name as the index shows it
 * ("Questions"), with the app's name when two apps have a model of that name.
 * Read from the index the data administrator sees, which lists every model.
 */
async function modelListUrl(world, model, app) {
  const key = `${siteRoot(world)}|${normal(app || '')}|${normal(model)}`;
  if (MODEL_URLS.has(key)) return MODEL_URLS.get(key);
  const client = await dataClient(world);
  const index = await client.get(adminUrl(world));
  const models = modelsOfIndex(index.html);
  const matches = models.filter((m) => normal(m.model) === normal(model) && (!app || normal(m.app) === normal(app)));
  if (matches.length !== 1) {
    throw friendly({
      message: matches.length
        ? `More than one app has a model "${model}": ${listed(matches.map((m) => `${m.model} of ${m.app}`))}.`
        : `The admin index lists no model "${model}"${app ? ` in the app "${app}"` : ''}. It lists: ${listed(models.map((m) => `${m.model} (${m.app})`))}.`,
      hint: matches.length ? `Name the app too: the "${model}" list of "${matches[0].app}".` : 'Write the model the way the admin index shows it: its plural name, such as "Questions" or "Users".',
    });
  }
  const url = absolute(world, matches[0].href);
  MODEL_URLS.set(key, url);
  return url;
}

// ---------------------------------------------------------------------------
// The test-data client: the admin's own pages, as the data administrator
// ---------------------------------------------------------------------------

const CLIENTS = new Map();

/** The handle of the account the test-data steps work as (`worldParameters.dataAdmin`, a superuser). */
function dataAdminHandle(world) {
  return (world.parameters && world.parameters.dataAdmin) || 'administrator';
}

/** The token a form of the admin carries against cross-site requests. */
function csrfOf(html) {
  const m = String(html).match(/name="csrfmiddlewaretoken" value="([^"]+)"/);
  return m ? m[1] : null;
}

/**
 * A client of the admin's own pages, logged in as the data administrator of
 * the users registry, with cookies of its own: the browser's session is never
 * touched. It reads pages and sends their forms the way the browser does
 * (the token of the form, the page it was sent from). One client per site
 * and account, for the whole run.
 */
async function dataClient(world) {
  const admin = resolveUser(world, dataAdminHandle(world));
  const key = `${siteRoot(world)}|${admin.username}`;
  if (CLIENTS.has(key)) return CLIENTS.get(key);
  const { request } = require('playwright');
  const context = await request.newContext({ ignoreHTTPSErrors: true });
  const retrying = async (fn) => {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await fn();
      } catch (err) {
        // A network change on the machine cuts a request now and then: go again, twice.
        if (attempt >= 2 || !/ERR_NETWORK_CHANGED|ECONNRESET|socket hang up|ETIMEDOUT|EPIPE/i.test(String(err && err.message))) throw err;
        await new Promise((r) => setTimeout(r, 500));
      }
    }
  };
  const get = async (url) => {
    const response = await retrying(() => context.get(url, { failOnStatusCode: false }));
    return { status: response.status(), url: response.url(), html: await response.text() };
  };
  const post = async (url, form) => {
    const page = await get(url);
    const token = csrfOf(page.html);
    if (!token) {
      throw friendly({ message: `The test-data client found no form on ${url} (HTTP ${page.status}, now at ${page.url}).`, hint: `The test-data steps work as worldParameters.dataAdmin ("${dataAdminHandle(world)}"): a superuser of the users registry, with its password.` });
    }
    const response = await retrying(() => context.post(url, {
      form: { csrfmiddlewaretoken: token, ...form },
      headers: { Referer: url },
      failOnStatusCode: false,
    }));
    return { status: response.status(), url: response.url(), html: await response.text(), before: page };
  };
  const login = adminUrl(world, 'login/?next=' + encodeURIComponent(adminPath(world)));
  const answer = await post(login, { username: admin.username, password: admin.password, next: adminPath(world) });
  if (!/id="logout-form"|id="user-tools"/.test(answer.html)) {
    const note = answer.html.match(/<p class="errornote">([\s\S]*?)<\/p>/);
    throw friendly({
      message: `The test-data steps could not log in to the admin as "${dataAdminHandle(world)}" (${admin.username}): ${note ? htmlText(note[1]) : `HTTP ${answer.status} at ${answer.url}`}.`,
      hint: 'worldParameters.dataAdmin names the account the test objects are made and deleted with: a superuser of the users registry, with its password.',
    });
  }
  const client = { get, post, context, admin };
  CLIENTS.set(key, client);
  return client;
}

/** Close the test-data clients at the end of the run. */
async function closeClients() {
  for (const client of CLIENTS.values()) await client.context.dispose().catch(() => {});
  CLIENTS.clear();
}

/** The objects a change list page shows: their text and the address of each one's page. */
function objectsOfList(html) {
  const found = [];
  const table = String(html).match(/<table id="result_list">([\s\S]*?)<\/table>/);
  if (!table) return found;
  const rows = table[1].match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || [];
  for (const row of rows) {
    const link = row.match(/<(?:th|td) class="field-[^"]*"[^>]*>\s*<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    if (link) found.push({ text: htmlText(link[2]), href: withoutQuery(decodeEntities(link[1])) });
  }
  return found;
}

/**
 * The objects of a model's list whose text is exactly the one given, found
 * with the list's own search when it has one (and on every page otherwise),
 * as the data administrator.
 */
async function findObjects(world, model, text, app) {
  const client = await dataClient(world);
  const list = await modelListUrl(world, model, app);
  const hits = [];
  for (let page = 1; page <= 50; page += 1) {
    const url = `${list}?q=${encodeURIComponent(text)}${page > 1 ? `&p=${page}` : ''}`;
    const answer = await client.get(url);
    const objects = objectsOfList(answer.html);
    for (const o of objects) if (normal(o.text) === normal(text)) hits.push(absolute(world, o.href));
    const pages = answer.html.match(/[?&]p=(\d+)/g) || [];
    const last = Math.max(1, ...pages.map((p) => parseInt(p.replace(/\D/g, ''), 10)));
    if (page >= last || !objects.length) break;
  }
  return [...new Set(hits)];
}

/**
 * Delete the object at its change page's address, through its delete page, as
 * the data administrator. An object that is no longer there is left alone.
 *
 * @returns {Promise<{deleted: boolean, refused: (string|null)}>}
 */
async function deleteObject(world, changeUrl) {
  const client = await dataClient(world);
  const url = withoutQuery(changeUrl).replace(/\/(change\/)?$/, '/') + 'delete/';
  const page = await client.get(url);
  if (page.status === 404 || !/name="post" value="yes"/.test(page.html)) {
    const protectedList = page.html.match(/<ul id="deleted-objects">([\s\S]*?)<\/ul>/);
    if (protectedList && !/name="post"/.test(page.html)) return { deleted: false, refused: htmlText(protectedList[1]) };
    return { deleted: false, refused: null };
  }
  const answer = await client.post(url, { post: 'yes' });
  return { deleted: answer.status < 400, refused: null };
}

/** Delete every object of a model's list with that text, as the data administrator. */
async function deleteObjectsNamed(world, model, text, app) {
  const urls = await findObjects(world, model, text, app);
  const refused = [];
  for (const url of urls) {
    const outcome = await deleteObject(world, url);
    if (outcome.refused) refused.push(outcome.refused);
  }
  if (refused.length) {
    throw friendly({
      message: `"${text}" of the "${model}" list could not be deleted: the admin keeps it for ${listed(refused)}.`,
      hint: 'A protected relation keeps it: delete the objects that point to it first.',
    });
  }
  return urls.length;
}

/** Give an account its password back, as the data administrator: the admin's own form for a user's password. */
async function setPasswordOf(world, username, password) {
  const urls = await findObjects(world, 'Users', username);
  if (!urls.length) {
    throw friendly({ message: `The "Users" list has no "${username}": its password could not be set back.`, hint: 'The build of the site makes the accounts of the users registry; build it again, or run its --add-users.' });
  }
  const client = await dataClient(world);
  const form = withoutQuery(urls[0]).replace(/change\/$/, '') + 'password/';
  const answer = await client.post(form, { usable_password: 'true', password1: password, password2: password, 'set-password': 'Change password' });
  if (/class="errornote"/.test(answer.html)) {
    const errors = (answer.html.match(/<ul class="errorlist[^"]*"[^>]*>([\s\S]*?)<\/ul>/g) || []).map(htmlText);
    throw friendly({ message: `The password of "${username}" could not be set back: ${listed(errors)}.`, hint: 'The admin\'s password rules refused the password of the users registry.' });
  }
}

// ---------------------------------------------------------------------------
// Cleaning up after a scenario
// ---------------------------------------------------------------------------

/** Whether the steps clean up after each scenario (`worldParameters.adminCleanUp`, on by default). */
function cleansUp(world) {
  return !(world.parameters && world.parameters.adminCleanUp === false);
}

/** Do something after the scenario, whatever happens in it (in the reverse order of the calls). */
function afterScenario(world, label, fn) {
  if (!world.__djangoCleanUp) world.__djangoCleanUp = [];
  if (world.__djangoCleanUp.some((item) => item.label === label)) return;
  world.__djangoCleanUp.push({ label, fn });
}

// ---------------------------------------------------------------------------
// Form fields, found by their labels
// ---------------------------------------------------------------------------

let MARK = 0;

/**
 * Find the field a person names by its label ("Question text", the closing
 * colon optional; a section's field by the label in its row; a tabular inline
 * row's field by its column), inside `scope` (a locator: the form, an inline
 * row), and say what kind it is. The admin draws a field's label as a
 * `label` (5.2 and 6.1), as the `legend` of the field's own fieldset (6.1:
 * dates and times, many-to-many fields), or next to a checkbox.
 *
 * @returns {Promise<{box: import('playwright').Locator, kind: string, label: string}|null>}
 */
async function findField(page, scope, label) {
  const mark = `f${(MARK += 1)}`;
  const found = await scope.first().evaluate((root, args) => {
    const [wanted, mark] = args;
    const norm = (t) => String(t || '').replace(/[­​-‏]/g, '').replace(/\s+/g, ' ').trim().replace(/\s*:$/, '').toLowerCase();
    const want = norm(wanted);
    const inInline = (el) => !!el.closest('.inline-group') && !root.closest('.inline-related') && !root.matches('.inline-related, tr');
    const kindOf = (box) => {
      if (box.querySelector('.readonly') && !box.querySelector('input:not([type=hidden]), select, textarea')) return 'readonly';
      if (box.querySelector('select.admin-autocomplete')) return 'autocomplete';
      if (box.querySelector('.selector, select.selectfilter, select.selectfilterstacked')) return 'selector';
      if (box.querySelector('input.vDateField') && box.querySelector('input.vTimeField')) return 'datetime';
      if (box.querySelector('input.vDateField')) return 'date';
      if (box.querySelector('input.vTimeField')) return 'time';
      if (box.querySelector('input[type=radio]')) return 'radio';
      if (box.querySelector('input[type=checkbox]') && !box.querySelector('input:not([type=checkbox]):not([type=hidden]), select, textarea')) return 'checkbox';
      if (box.querySelector('input[type=file]')) return 'file';
      if (box.querySelector('select[multiple]')) return 'multiselect';
      if (box.querySelector('select')) return 'select';
      if (box.querySelector('textarea')) return 'textarea';
      if (box.querySelector('input:not([type=hidden])')) return 'text';
      return 'unknown';
    };
    // The sub-labels of a widget are no field's label: "Date:" and "Time:", the lists of a selector.
    const isSubLabel = (el) => !!el.closest('p.datetime, .selector, .select2-container, .datetimeshortcuts, .help');
    const candidates = [...root.querySelectorAll('label, legend')].filter((el) => !isSubLabel(el) && !inInline(el));
    const labels = [];
    for (const el of candidates) {
      const text = norm(el.textContent);
      if (!text) continue;
      labels.push(el.textContent.replace(/\s+/g, ' ').trim());
      if (text !== want) continue;
      let box = null;
      if (el.tagName === 'LEGEND') box = el.parentElement;
      else if (el.classList.contains('vCheckboxLabel')) box = el.closest('.checkbox-row, .fieldBox, .form-row') || el.parentElement;
      else box = el.closest('.fieldBox') || el.closest('.form-row') || el.parentElement;
      if (!box) continue;
      box.setAttribute('data-wsj-field', mark);
      return { kind: kindOf(box), label: el.textContent.replace(/\s+/g, ' ').trim() };
    }
    // A tabular inline row: the field is in the column whose heading is the label.
    const row = root.matches('tr') ? root : null;
    if (row) {
      const table = row.closest('table');
      const heads = table ? [...table.querySelectorAll('thead th')] : [];
      for (const th of heads) {
        if (norm(th.textContent) !== want) continue;
        const column = [...th.classList].find((c) => c.startsWith('column-'));
        const cell = column ? row.querySelector('td.field-' + column.slice('column-'.length)) : row.children[heads.indexOf(th)];
        if (!cell) continue;
        cell.setAttribute('data-wsj-field', mark);
        return { kind: kindOf(cell), label: th.textContent.replace(/\s+/g, ' ').trim() };
      }
      for (const th of heads) if (norm(th.textContent)) labels.push(th.textContent.replace(/\s+/g, ' ').trim());
    }
    return { kind: null, labels };
  }, [label, mark]).catch(() => null);
  if (!found || !found.kind) return found ? { missing: true, labels: found.labels || [] } : null;
  return { box: page.locator(`[data-wsj-field="${mark}"]`), kind: found.kind, label: found.label };
}

/** The form of the page a field step works in: the change form, or the main form of the content. */
function mainForm(page) {
  return page.locator('#content-main form, #content form').first();
}

/** Find a field or fail with the labels the form has. */
async function fieldOrFail(world, scope, label, where) {
  const field = await findField(world.page, scope, label);
  if (field && !field.missing) return field;
  throw friendly({
    message: `${where || 'The form'} has no field "${label}". Its fields: ${listed((field && field.labels) || [])}.`,
    hint: hintFor(world, 'Name a field by its label as the form shows it, without the colon ("Question text"); a field of an inline row by its column ("Choice text").'),
  });
}

const YES = /^(yes|true|on|checked|ticked|1)$/i;
const NO = /^(no|false|off|unchecked|unticked|0)$/i;

/** The values of a list field from a step ("Fun, Serious"), each trimmed. */
function valuesOf(value) {
  return String(value).split(',').map(clean).filter(Boolean);
}

/**
 * Choose an object in an autocomplete field (the admin's select2 box): open
 * it, type the text, wait for the answer of the admin's autocomplete request
 * to that text, and choose the result whose text is exactly the one given.
 */
async function chooseAutocomplete(world, page, box, value, label) {
  const select = box.locator('select.admin-autocomplete').first();
  const id = await select.getAttribute('id');
  if (!clean(value)) {
    const clear = box.locator('.select2-selection__clear');
    if (await clear.count()) await clear.first().click();
    return;
  }
  await box.locator('.select2-selection').first().click();
  const search = page.locator('.select2-container--open .select2-search__field');
  await search.waitFor({ state: 'visible', timeout: budget(world) });
  const answered = page.waitForResponse((r) => {
    try {
      const u = new URL(r.url());
      return /\/autocomplete\/?$/.test(u.pathname) && u.searchParams.get('term') === value;
    } catch { return false; }
  }, { timeout: budget(world) }).catch(() => null);
  await search.fill(value);
  await answered;
  const results = page.locator(`#select2-${id}-results`);
  await page.waitForFunction((rid) => {
    const list = document.getElementById(rid);
    return !!list && !list.querySelector('.loading-results');
  }, `select2-${id}-results`, { timeout: budget(world) }).catch(() => {});
  const options = results.locator('li.select2-results__option').filter({ hasText: new RegExp('^\\s*' + escapeRegExp(clean(value)) + '\\s*$') });
  if (!(await options.count())) {
    const offered = await results.locator('li.select2-results__option').allTextContents().catch(() => []);
    await page.keyboard.press('Escape').catch(() => {});
    throw friendly({
      message: `The autocomplete field "${label}" offers no "${value}" for that text. It offers: ${listed(offered)}.`,
      hint: hintFor(world, 'The field searches the objects the admin of its model searches (search_fields); write the object as the field lists it.'),
    });
  }
  await options.first().click();
  await eventually(world,
    () => box.locator('.select2-selection__rendered').first().getAttribute('title').catch(() => null),
    (title) => normal(title) === normal(value),
    (title) => ({ message: `The autocomplete field "${label}" shows "${title || '(nothing)'}" after choosing "${value}".`, hint: 'The choice did not reach the field.' }));
}

/** The lists and buttons of a two-list selector: what is available, what is chosen. */
function selectorParts(box) {
  return {
    from: box.locator('select[id$="_from"]').first(),
    to: box.locator('select[id$="_to"]').first(),
    add: box.locator('button.selector-add, a.selector-add').first(),
    remove: box.locator('button.selector-remove, a.selector-remove').first(),
    addAll: box.locator('button.selector-chooseall, a.selector-chooseall').first(),
    removeAll: box.locator('button.selector-clearall, a.selector-clearall').first(),
    filter: box.locator('input[id$="_input"]').first(),
  };
}

/** The options of a list, as their texts. */
async function optionTexts(select) {
  return (await select.locator('option').allTextContents().catch(() => [])).map(clean);
}

/** Move options from one list of a selector to the other, by their texts, with the list's own button. */
async function moveInSelector(world, box, values, direction, label) {
  const parts = selectorParts(box);
  const source = direction === 'choose' ? parts.from : parts.to;
  const button = direction === 'choose' ? parts.add : parts.remove;
  const have = await optionTexts(source);
  const missing = values.filter((v) => !have.some((h) => normal(h) === normal(v)));
  if (missing.length) {
    const other = await optionTexts(direction === 'choose' ? parts.to : parts.from);
    throw friendly({
      message: `The ${direction === 'choose' ? 'available' : 'chosen'} "${label}" have no ${listed(missing)}. ${direction === 'choose' ? 'Available' : 'Chosen'}: ${listed(have)}; ${direction === 'choose' ? 'chosen' : 'available'}: ${listed(other)}.`,
      hint: 'Write the option as the list shows it. An option in the other list is already where the step would move it.',
    });
  }
  const exact = values.map((v) => have.find((h) => normal(h) === normal(v)));
  await source.selectOption(exact.map((label) => ({ label })));
  await button.click();
  // The options leave the list they were in. (The other list may hide them: its filter box shows only the
  // options with its text.)
  await eventually(world, () => optionTexts(source),
    (now) => exact.every((v) => !now.includes(v)),
    (now) => ({ message: `After pressing "${direction === 'choose' ? 'Choose' : 'Remove'}", the ${direction === 'choose' ? 'available' : 'chosen'} "${label}" still list ${listed(exact.filter((v) => now.includes(v)))}.`, hint: 'The selector did not move the options.' }));
}

/** Open the folded section (a closed details element) a field is in, with its heading, so that the field shows. */
async function openFoldedSection(box) {
  const closed = await box.evaluate((el) => { const d = el.closest('details'); return !!d && !d.open; }).catch(() => false);
  if (!closed) return false;
  await box.locator('xpath=ancestor::details[1]/summary').first().click();
  await box.page().waitForFunction((el) => { const d = el.closest('details'); return !d || d.open; }, await box.elementHandle(), { timeout: 5000 }).catch(() => {});
  return true;
}

/**
 * Set a field to a value, whatever its kind: a text, a list (by the option's
 * text), a box to tick ("yes" / "no"), a date ("2026-01-15", "today"), a time
 * ("10:30:00", "now"), a date and time ("2026-01-15 10:30", "now"), an
 * autocomplete field (by the object's text), a two-list selector ("Fun,
 * Serious": exactly those chosen), a file (a path).
 */
async function setField(world, scope, label, value, where) {
  const page = world.page;
  const field = await fieldOrFail(world, scope, label, where);
  const { box, kind } = field;
  const text = value === null || value === undefined ? '' : String(value);
  const T = { timeout: budget(world) };
  // A field in a folded section is hidden: open the section first, as a person does.
  await openFoldedSection(box);
  switch (kind) {
    case 'readonly':
      throw friendly({ message: `The field "${label}" is read-only: it shows "${clean(await box.locator('.readonly').first().innerText())}" and takes no value.`, hint: 'Check it with: Then "' + label + '" should be read-only' });
    case 'autocomplete':
      await chooseAutocomplete(world, page, box, text, label);
      return;
    case 'selector': {
      const parts = selectorParts(box);
      const wanted = valuesOf(text);
      const chosen = await optionTexts(parts.to);
      const drop = chosen.filter((c) => !wanted.some((w) => normal(w) === normal(c)));
      if (drop.length) await moveInSelector(world, box, drop, 'remove', label);
      const now = await optionTexts(parts.to);
      const add = wanted.filter((w) => !now.some((c) => normal(c) === normal(w)));
      if (add.length) await moveInSelector(world, box, add, 'choose', label);
      return;
    }
    case 'datetime': {
      if (/^(now|today)$/i.test(text)) {
        // The shortcuts beside the two inputs: "Today" for the date, "Now" for the time.
        await box.locator('.datetimeshortcuts').nth(0).locator('a').first().click(T);
        await box.locator('.datetimeshortcuts').nth(1).locator('a').first().click(T);
        return;
      }
      const m = text.match(/^(\S+)(?:\s+(\S+))?$/);
      await box.locator('input.vDateField').first().fill(m ? m[1] : '', T);
      await box.locator('input.vTimeField').first().fill(m && m[2] ? m[2] : '', T);
      return;
    }
    case 'date':
      if (/^today$/i.test(text)) { await box.locator('.datetimeshortcuts a').first().click(T); return; }
      await box.locator('input.vDateField').first().fill(text, T);
      return;
    case 'time':
      if (/^now$/i.test(text)) { await box.locator('.datetimeshortcuts a').first().click(T); return; }
      await box.locator('input.vTimeField').first().fill(text, T);
      return;
    case 'checkbox': {
      const box1 = box.locator('input[type=checkbox]').first();
      if (YES.test(text)) await box1.check(T);
      else if (NO.test(text)) await box1.uncheck(T);
      else throw friendly({ message: `"${text}" is no state for the box "${label}".`, hint: 'Write "yes" to tick it and "no" to clear it.' });
      return;
    }
    case 'radio': {
      const radios = box.locator('input[type=radio]');
      const count = await radios.count();
      const offered = [];
      for (let i = 0; i < count; i += 1) {
        const radio = radios.nth(i);
        const id = await radio.getAttribute('id');
        const own = clean(await box.locator(`label[for="${id}"]`).first().innerText().catch(() => '')) || clean(await radio.evaluate((el) => (el.closest('label') ? el.closest('label').textContent : el.value)));
        offered.push(own);
        if (normal(own) === normal(text)) { await radio.check(T); return; }
      }
      throw friendly({ message: `The field "${label}" has no choice "${text}". Its choices: ${listed(offered)}.`, hint: 'Write the choice as the form shows it.' });
    }
    case 'multiselect': {
      const select = box.locator('select[multiple]').first();
      const have = await optionTexts(select);
      const wanted = valuesOf(text).map((w) => have.find((h) => normal(h) === normal(w)) || w);
      await select.selectOption(wanted.map((label) => ({ label })), T);
      return;
    }
    case 'select': {
      const select = box.locator('select').first();
      const have = await optionTexts(select);
      const exact = have.find((h) => normal(h) === normal(text));
      if (exact === undefined) {
        throw friendly({ message: `The list "${label}" has no option "${text}". Its options: ${listed(have)}.`, hint: 'Write the option as the list shows it.' });
      }
      await select.selectOption({ label: exact }, T);
      return;
    }
    case 'file':
      await box.locator('input[type=file]').first().setInputFiles(text, T);
      return;
    case 'textarea':
      await box.locator('textarea').first().fill(text, T);
      return;
    case 'text':
      await box.locator('input:not([type=hidden]):not([type=checkbox]):not([type=radio])').first().fill(text, T);
      return;
    default:
      throw friendly({ message: `The field "${label}" is of a kind the steps do not know how to set.`, hint: 'Set it with webship-js\'s own steps, by its name: I fill in "<name>" with "<value>" by attr' });
  }
}

/** What a field shows now, as a text, whatever its kind (see setField). */
async function readField(world, scope, label, where) {
  const field = await fieldOrFail(world, scope, label, where);
  const { box, kind } = field;
  switch (kind) {
    case 'readonly':
      return clean(await box.locator('.readonly').first().innerText());
    case 'autocomplete': {
      const title = await box.locator('.select2-selection__rendered').first().getAttribute('title').catch(() => null);
      if (title) return clean(title);
      return clean(await box.locator('select.admin-autocomplete option:checked').first().textContent().catch(() => ''));
    }
    case 'selector':
      return (await optionTexts(selectorParts(box).to)).join(', ');
    case 'datetime':
      return clean(`${await box.locator('input.vDateField').first().inputValue()} ${await box.locator('input.vTimeField').first().inputValue()}`);
    case 'date':
      return box.locator('input.vDateField').first().inputValue();
    case 'time':
      return box.locator('input.vTimeField').first().inputValue();
    case 'checkbox':
      return (await box.locator('input[type=checkbox]').first().isChecked()) ? 'yes' : 'no';
    case 'radio': {
      const checked = box.locator('input[type=radio]:checked');
      if (!(await checked.count())) return '';
      return clean(await checked.first().evaluate((el) => {
        const own = el.id && document.querySelector(`label[for="${el.id}"]`);
        return own ? own.textContent : (el.closest('label') ? el.closest('label').textContent : el.value);
      }));
    }
    case 'multiselect':
      return (await box.locator('select[multiple] option:checked').allTextContents()).map(clean).join(', ');
    case 'select':
      return clean(await box.locator('select option:checked').first().textContent().catch(() => ''));
    case 'textarea':
      return box.locator('textarea').first().inputValue();
    case 'text':
      return box.locator('input:not([type=hidden]):not([type=checkbox]):not([type=radio])').first().inputValue();
    default:
      return clean(await box.innerText());
  }
}

// ---------------------------------------------------------------------------
// The change list
// ---------------------------------------------------------------------------

/** Whether the page is a change list (the admin marks its body with the class change-list). */
async function onChangeList(page) {
  return page.locator('body.change-list').count().then((n) => n > 0).catch(() => false);
}

/** Fail unless the page is a change list. */
async function changeListOrFail(world) {
  if (await onChangeList(world.page)) return;
  throw friendly({
    message: `The page is not a list of the admin: ${await pageSummary(world)}.`,
    hint: hintFor(world, 'Open the list first: When I open the "Questions" list'),
  });
}

/** The rows of the change list on screen: the object's text (the row's link) and the text of each cell. */
async function listRows(page) {
  return page.evaluate(() => {
    const table = document.getElementById('result_list');
    if (!table) return [];
    return [...table.querySelectorAll('tbody tr')].map((tr) => {
      const head = tr.querySelector('th') || tr.querySelector('td:not(.action-checkbox)');
      return {
        object: (head ? head.textContent : '').replace(/\s+/g, ' ').trim(),
        selected: tr.classList.contains('selected') || !!(tr.querySelector('input.action-select') || {}).checked,
      };
    });
  }).catch(() => []);
}

/** The headings of the change list's columns, without the checkbox column. */
async function listColumns(page) {
  return page.evaluate(() => {
    const table = document.getElementById('result_list');
    if (!table) return [];
    return [...table.querySelectorAll('thead th')].filter((th) => !th.classList.contains('action-checkbox-column')).map((th) => th.textContent.replace(/\s+/g, ' ').trim());
  }).catch(() => []);
}

/**
 * The text of one cell of the change list: the row of an object, the column
 * of a heading. A yes/no column shows an icon: its text is the icon's
 * description ("True", "False", "None").
 */
async function listCell(page, object, column) {
  return page.evaluate(([object, column]) => {
    const norm = (t) => String(t || '').replace(/[“”"‘’']/g, "'").replace(/\s+/g, ' ').trim().toLowerCase();
    const table = document.getElementById('result_list');
    if (!table) return { error: 'no list' };
    const heads = [...table.querySelectorAll('thead th')];
    const index = heads.findIndex((th) => norm(th.textContent) === norm(column));
    if (index < 0) return { error: 'column', columns: heads.map((th) => th.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean) };
    const rows = [...table.querySelectorAll('tbody tr')];
    const row = rows.find((tr) => { const head = tr.querySelector('th') || tr.querySelector('td:not(.action-checkbox)'); return head && norm(head.textContent) === norm(object); });
    if (!row) return { error: 'row', rows: rows.map((tr) => (tr.querySelector('th') || tr).textContent.replace(/\s+/g, ' ').trim()) };
    const cell = row.children[index];
    if (!cell) return { error: 'cell' };
    const icon = cell.querySelector('img[alt]');
    const text = cell.textContent.replace(/\s+/g, ' ').trim();
    return { text: text || (icon ? icon.getAttribute('alt') : '') };
  }, [object, column]);
}

/** The count the change list gives: "24 questions" (the paginator), and after a search "2 results (24 total)". */
async function listCounts(page) {
  return page.evaluate(() => {
    const pag = document.querySelector('.paginator');
    const search = document.querySelector('#changelist-search .small.quiet, #toolbar .small.quiet');
    const found = search ? search.textContent.replace(/\s+/g, ' ').match(/(\d+)\s+results?\s*\((\d+)/) : null;
    // The count is the text of the paginator itself, outside its page links: "24 questions".
    const own = pag ? [...pag.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' ') : '';
    const m = own.match(/(\d+)\s+\S/);
    return {
      paginator: own,
      count: m ? parseInt(m[1], 10) : null,
      results: found ? parseInt(found[1], 10) : null,
      total: found ? parseInt(found[2], 10) : null,
      searchText: search ? search.textContent.replace(/\s+/g, ' ').trim() : '',
    };
  }).catch(() => ({ paginator: '', count: null, results: null, total: null, searchText: '' }));
}

/** The pages of the change list: the current one, and how many. */
async function listPages(page) {
  return page.evaluate(() => {
    const pag = document.querySelector('.paginator');
    if (!pag) return { current: 1, last: 1 };
    const current = pag.querySelector('[aria-current="page"], .this-page');
    const numbers = [...pag.querySelectorAll('a, span.this-page')].map((e) => parseInt(e.textContent.trim(), 10)).filter((n) => !Number.isNaN(n));
    return { current: current ? parseInt(current.textContent.trim(), 10) : 1, last: numbers.length ? Math.max(...numbers) : 1 };
  }).catch(() => ({ current: 1, last: 1 }));
}

/** The filter of the sidebar with that title ("By category", or "category"). */
function filterBlock(page, title) {
  const want = normal(title).replace(/^by /, '');
  return page.locator('#changelist-filter details').filter({
    has: page.locator('summary', { hasText: new RegExp('^\\s*(?:By\\s+)?' + escapeRegExp(clean(title).replace(/^By\s+/i, '')) + '\\s*$', 'i') }),
  }).or(page.locator(`#changelist-filter details[data-filter-title="${want.replace(/"/g, '\\"')}"]`));
}

/** The titles of the sidebar's filters. */
async function filterTitles(page) {
  return (await page.locator('#changelist-filter details summary, #changelist-filter h3').allTextContents().catch(() => [])).map(clean).filter((t) => t && !/^(show counts|hide counts|✖ clear all filters)$/i.test(t));
}

// ---------------------------------------------------------------------------
// Inline rows
// ---------------------------------------------------------------------------

/** The inline group with that heading ("Choices"): its rows, whether tabular or stacked. */
async function inlineGroup(world, name) {
  const page = world.page;
  const groups = page.locator('.inline-group');
  const count = await groups.count();
  const names = [];
  for (let i = 0; i < count; i += 1) {
    const group = groups.nth(i);
    const title = clean(await group.locator('h2').first().innerText().catch(() => ''));
    names.push(title);
    if (normal(title) === normal(name)) {
      const prefix = await group.evaluate((g) => {
        try { return JSON.parse(g.dataset.inlineFormset).options.prefix; } catch { return (g.id || '').replace(/-group$/, ''); }
      });
      const tabular = (await group.getAttribute('data-inline-type')) === 'tabular';
      return { group, prefix, tabular };
    }
  }
  throw friendly({
    message: `The form has no inline "${name}". Its inlines: ${listed(names)}.`,
    hint: hintFor(world, 'Name an inline by its heading on the form, such as "Choices".'),
  });
}

/** The rows of an inline group: its saved and new rows, without the hidden template, in page order. */
function inlineRows(inline) {
  const ids = `[id^="${inline.prefix}-"]:not([id$="-empty"]):not(.empty-form)`;
  return inline.tabular
    ? inline.group.locator(`tbody tr.form-row${ids}`)
    : inline.group.locator(`.inline-related${ids}`);
}

/** Row n (from 1) of an inline group, or a failure that says how many rows it has. */
async function inlineRow(world, inline, n, name) {
  const rows = inlineRows(inline);
  const count = await rows.count();
  if (n < 1 || n > count) {
    throw friendly({ message: `The inline "${name}" has no row ${n}: it has ${count} row${count === 1 ? '' : 's'}.`, hint: `Add a row first: When I add a row to the "${name}" inline` });
  }
  return rows.nth(n - 1);
}

module.exports = {
  budget,
  clean,
  normal,
  mentions,
  listed,
  escapeRegExp,
  decodeEntities,
  htmlText,
  siteRoot,
  adminPath,
  adminUrl,
  absolute,
  withoutQuery,
  cutRequest,
  CUT_HINT,
  hintFor,
  adminReady,
  open,
  afterNavigation,
  heading,
  pageSummary,
  eventually,
  messages,
  formErrors,
  resolveUser,
  userName,
  signedInName,
  submitLogin,
  logInAs,
  forgetSession,
  currentUser,
  LOGIN_HINT,
  modelsOfIndex,
  modelListUrl,
  dataAdminHandle,
  dataClient,
  closeClients,
  objectsOfList,
  findObjects,
  deleteObject,
  deleteObjectsNamed,
  setPasswordOf,
  cleansUp,
  afterScenario,
  findField,
  fieldOrFail,
  openFoldedSection,
  mainForm,
  setField,
  readField,
  selectorParts,
  optionTexts,
  moveInSelector,
  chooseAutocomplete,
  onChangeList,
  changeListOrFail,
  listRows,
  listColumns,
  listCell,
  listCounts,
  listPages,
  filterBlock,
  filterTitles,
  inlineGroup,
  inlineRows,
  inlineRow,
};
