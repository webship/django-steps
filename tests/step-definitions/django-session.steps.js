'use strict';

// The session: logging in to the admin by a handle of the users registry or
// with a user name and a password, the refusal of the login form, logging out,
// and who is signed in.
//
// Accounts are configuration, not test data: they are listed in cucumber.js
// (`worldParameters.users`) and made once by the build of the site. A feature
// never creates or deletes an account.

const { Given, When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const {
  budget,
  normal,
  listed,
  adminUrl,
  cutRequest,
  CUT_HINT,
  hintFor,
  open,
  afterNavigation,
  pageSummary,
  eventually,
  resolveUser,
  userName,
  signedInName,
  submitLogin,
  logInAs,
  forgetSession,
  formErrors,
} = require('./django-helpers');

/**
 * Log in to the admin as an account of the users registry
 * (`worldParameters.users` in cucumber.js), by its handle. An account that
 * logged in earlier in the run takes its session over; otherwise the step logs
 * in through the login form. The step ends on the admin index.
 *
 * Example #1: Given I am a logged in user with the "editor" user
 * Example #2: Given we are a logged in user with the "administrator" user
 * Example #3: Given I am a logged in user with "viewer"
 * Example #4: And I am a logged in user with the "viewer" user
 * Example #5: Given we are a logged in user with the "editor" user
 */
Given(/^(I am |we are )*a logged in user with( the)* "([^"]*)"( user)*$/, { timeout: 120000 }, async function (pronounCase, theCase, handle, userCase) {
  await logInAs(this, handle);
});

/**
 * Log in through the admin login form as an account of the users registry, as
 * a person does: a new session, never one taken over. For the scenarios that
 * test the form itself; the step fails when the admin refuses the login.
 *
 * Example #1: When I log in as "editor" with the login form
 * Example #2: When we log in as "viewer" with the login form
 * Example #3: And I log in as "administrator" with the login form
 * Example #4: When I log in as "viewer" with the login form
 * Example #5: Then we log in as "editor" with the login form
 */
When(/^(I |we )*log in as "([^"]*)" with the login form$/, { timeout: 120000 }, async function (pronounCase, handle) {
  const user = resolveUser(this, handle);
  const outcome = await submitLogin(this, user.username, user.password);
  if (!outcome.name) {
    throw friendly({
      message: `The login form refused "${handle}" (${user.username}): ${listed(outcome.errors)}.`,
      hint: outcome.cut ? CUT_HINT : 'Check the user name and the password of the account in worldParameters.users, and that the build of the site made it a staff account.',
    });
  }
  this.__djangoUser = user;
});

/**
 * Send the admin login form with a user name and a password. The step does
 * not expect the login to succeed: assert the outcome with the next step. A
 * new password (after a password change) logs in this way too.
 *
 * Example #1: When I log in with the user name "nobody" and the password "Wrong-password-1"
 * Example #2: When we log in with the user name "viewer" and the password "Not-the-password-2"
 * Example #3: And I log in with the user name "editor" and the password "Changed-pass-2026!"
 * Example #4: When I log in with the user name "" and the password "Wrong-password-1"
 * Example #5: When we log in with the user name "Someone unknown" and the password "x"
 */
When(/^(I |we )*log in with the user name "([^"]*)" and the password "([^"]*)"$/, { timeout: 120000 }, async function (pronounCase, username, password) {
  const outcome = await submitLogin(this, username || '', password || '');
  this.__loginOutcome = outcome;
  if (outcome.name) {
    const users = (this.parameters && this.parameters.users) || {};
    const handle = Object.keys(users).find((h) => String(users[h].username).toLowerCase() === String(username).toLowerCase());
    this.__djangoUser = { handle: handle || username, username, password };
  }
});

/**
 * Assert that the login page refused the login with an error (or a part of
 * it), and that nobody is signed in. The admin writes one error for a wrong
 * password, an unknown user name and an account that is not staff alike.
 *
 * Example #1: Then the login should be refused with "Please enter the correct username and password for a staff account."
 * Example #2: Then the login should be refused with "Note that both fields may be case-sensitive."
 * Example #3: And the login should be refused with "Please enter the correct username and password"
 * Example #4: Then the login should be refused with "for a staff account"
 * Example #5: Then the login should be refused with "Please enter the correct username and password for a staff account. Note that both fields may be case-sensitive."
 */
Then(/^the login should be refused with "([^"]*)"$/, async function (expected) {
  const page = this.page;
  const name = await signedInName(page);
  const errors = await formErrors(page);
  const onLogin = await page.locator('#login-form').count();
  if (name || !onLogin || !errors.some((e) => normal(e).includes(normal(expected)))) {
    throw friendly({
      message: name
        ? `The login was not refused: the admin greets "${name}".`
        : `The login page did not refuse the login with "${expected}". Its errors: ${listed(errors)}; ${await pageSummary(this)}.`,
      hint: hintFor(this, 'Send the form first (When I log in with the user name "..." and the password "..."); the admin writes its error above the form.'),
    });
  }
});

/**
 * Start as a visitor of the admin: no session (the cookies of the browser
 * cleared), on the admin login page. webship-js's "I am an anonymous user"
 * opens the site's root instead, which a plain project does not have (the
 * browser then logs its 404).
 *
 * Example #1: Given I am not logged in
 * Example #2: Given we are not logged in
 * Example #3: And I am not logged in
 * Example #4: Given I am not logged in
 * Example #5: When we are not logged in
 */
Given(/^(I am |we are )*not logged in$/, async function (pronounCase) {
  await this.page.context().clearCookies();
  forgetSession(this);
  this.__djangoUser = null;
  await open(this, adminUrl(this, 'login/'));
});

/**
 * Log out as a person does: the "Log out" button of the user tools (a form
 * the admin sends with POST), then the "Logged out" page. On a page that is
 * not the admin's, the step opens the admin index first.
 *
 * Example #1: When I log out
 * Example #2: When we log out
 * Example #3: And I log out
 * Example #4: Then I log out
 * Example #5: Given I log out
 */
When(/^(I |we )*log out$/, { timeout: 90000 }, async function (pronounCase) {
  const page = this.page;
  forgetSession(this, this.__djangoUser && this.__djangoUser.username);
  if (!(await page.locator('#logout-form').count())) await open(this, adminUrl(this));
  if (!(await page.locator('#logout-form').count())) {
    this.__djangoUser = null;
    return; // nobody is signed in
  }
  await afterNavigation(this, () => page.locator('#logout-form [type="submit"]').first().click());
  this.__djangoUser = null;
  await eventually(this, () => signedInName(page), (name) => !name,
    async (name) => ({ message: `After "Log out" the admin still greets "${name}": ${await pageSummary(this)}.`, hint: hintFor(this, 'The "Log out" button sends the logout form of the user tools.') }));
});

/**
 * Assert who the admin greets in its user tools ("Welcome, editor."): a
 * handle of the users registry or a user name. The admin greets an account
 * by its first name when it has one, else by its user name.
 *
 * Example #1: Then I should be logged in as "editor"
 * Example #2: Then we should be logged in as "administrator"
 * Example #3: And I should be logged in as "viewer"
 * Example #4: Then I should be logged in as "editor"
 * Example #5: And we should be logged in as "viewer"
 */
Then(/^(I |we )*should be logged in as "([^"]*)"$/, async function (pronounCase, who) {
  const expected = userName(this, who);
  const page = this.page;
  if (!(await page.locator('#user-tools').count())) await open(this, adminUrl(this));
  const name = await signedInName(page);
  if (!name || normal(name) !== normal(expected)) {
    throw friendly({
      message: name ? `The admin greets "${name}", not "${expected}".` : `Nobody is logged in to the admin: ${await pageSummary(this)}.`,
      hint: hintFor(this, 'Log in first: Given I am a logged in user with the "editor" user'),
    });
  }
});

/**
 * Assert that someone is, or nobody is, logged in to the admin. On a page
 * that is not the admin's, the step opens the admin index to see.
 *
 * Example #1: Then I should be logged in
 * Example #2: Then I should not be logged in
 * Example #3: And we should be logged in
 * Example #4: And we should not be logged in
 * Example #5: Then I should not be logged in
 */
Then(/^(I |we )*should( not)* be logged in$/, async function (pronounCase, notCase) {
  const page = this.page;
  if (!(await page.locator('#user-tools, #login-form').count()) || cutRequest(this)) await open(this, adminUrl(this));
  const name = await signedInName(page);
  if (notCase && name) {
    throw friendly({ message: `The admin greets "${name}": someone is logged in.`, hint: 'Log out first: When I log out' });
  }
  if (!notCase && !name) {
    throw friendly({ message: `Nobody is logged in to the admin: ${await pageSummary(this)}.`, hint: hintFor(this, 'Log in first: Given I am a logged in user with the "editor" user') });
  }
});

/**
 * Assert that the page is (or is not) the admin login page: the form with
 * "Username" and "Password" that a visitor is sent to.
 *
 * Example #1: Then I should be on the admin login page
 * Example #2: Then I should not be on the admin login page
 * Example #3: And we should be on the admin login page
 * Example #4: Then we should not be on the admin login page
 * Example #5: And I should be on the admin login page
 */
Then(/^(I |we )*should( not)* be on the admin login page$/, async function (pronounCase, notCase) {
  const page = this.page;
  const read = async () => (await page.locator('#login-form input[name="username"]').count()) > 0;
  const on = await eventually(this, read, (v) => v === !notCase, async () => ({
    message: notCase ? `The page is the admin login page: ${await pageSummary(this)}.` : `The page is not the admin login page: ${await pageSummary(this)}.`,
    hint: hintFor(this, 'A visitor who opens a page of the admin is sent to its login page.'),
  }), notCase ? 2000 : budget(this)).catch((err) => { throw err; });
  return on;
});
