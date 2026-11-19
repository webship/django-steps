'use strict';

// The accounts: changing one's own password (and its refusals), and the users
// and groups of the admin: an account's status, its groups, a group's
// permissions. A changed password is set back after the scenario, as the data
// administrator; no step creates or deletes an account.

const { When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const {
  clean,
  normal,
  listed,
  adminUrl,
  hintFor,
  open,
  afterNavigation,
  pageSummary,
  formErrors,
  currentUser,
  userName,
  forgetSession,
  findObjects,
  setPasswordOf,
  afterScenario,
  cleansUp,
} = require('./django-helpers');

/** Open the password change form of the account that is logged in (the user tools' "Change password"). */
async function openPasswordChange(world) {
  const page = world.page;
  await open(world, adminUrl(world, 'password_change/'));
  if (!(await page.locator('input[name="old_password"]').count())) {
    throw friendly({ message: `The password change form did not open: ${await pageSummary(world)}.`, hint: hintFor(world, 'Log in first: Given I am a logged in user with the "editor" user') });
  }
}

/** Send the password change form with an old password and two new ones. */
async function sendPasswordChange(world, oldPassword, first, second) {
  const page = world.page;
  await openPasswordChange(world);
  await page.locator('input[name="old_password"]').fill(oldPassword);
  await page.locator('input[name="new_password1"]').fill(first);
  await page.locator('input[name="new_password2"]').fill(second);
  await afterNavigation(world, () => page.locator('#content-main form [type="submit"]').first().click());
}

/** Whether the page says the password was changed: the admin's "Password change successful" page. */
async function passwordChanged(page) {
  try {
    return /\/password_change\/done\/?$/.test(new URL(page.url()).pathname);
  } catch {
    return false;
  }
}

/**
 * Change the password of the account that is logged in, through the admin's
 * own form ("Change password" in the user tools): its password from the users
 * registry, then the new one twice. The step sets the password of the
 * registry back after the scenario, as the data administrator.
 *
 * Example #1: When I change my password to "Changed-pass-2026!"
 * Example #2: When I change my password to "Another-pass-2026?"
 * Example #3: And I change my password to "Changed-pass-2026!"
 * Example #4: When I change my password to "Third-pass-2026#"
 * Example #5: Given I change my password to "Changed-pass-2026!"
 */
When(/^(I |we )*change my password to "([^"]*)"$/, async function (pronounCase, password) {
  const user = currentUser(this);
  if (cleansUp(this)) {
    afterScenario(this, `password:${user.username}`, async () => {
      await setPasswordOf(this, user.username, user.password);
      forgetSession(this, user.username);
    });
  }
  await sendPasswordChange(this, user.password, password, password);
  if (!(await passwordChanged(this.page))) {
    const errors = [...await formErrors(this.page), ...(await this.page.locator('#content-main ul.errorlist li').allTextContents().catch(() => [])).map(clean)];
    throw friendly({ message: `The admin refused the new password: ${listed(errors)}.`, hint: 'The admin\'s password rules (AUTH_PASSWORD_VALIDATORS) refuse short, common, numeric passwords and ones close to the account\'s name.' });
  }
  forgetSession(this, user.username);
});

/**
 * Send the password change form with values that the admin should refuse:
 * an old password, and the new password and its confirmation. "with my old
 * password" types the password of the users registry. Assert the refusal with
 * the next step; a password the admin accepts is set back after the scenario.
 *
 * Example #1: When I try to change my password with the old password "Not-the-password-1" and the new passwords "Changed-pass-2026!" and "Changed-pass-2026!"
 * Example #2: When I try to change my password with my old password and the new passwords "Changed-pass-2026!" and "Changed-pass-2026?"
 * Example #3: And we try to change my password with my old password and the new passwords "password" and "password"
 * Example #4: When I try to change my password with my old password and the new passwords "12345678901" and "12345678901"
 * Example #5: And I try to change my password with the old password "" and the new passwords "" and ""
 */
When(/^(I |we )*try to change my password with (?:the old password "([^"]*)"|my old password) and the new passwords "([^"]*)" and "([^"]*)"$/, async function (pronounCase, oldPassword, first, second) {
  const user = currentUser(this);
  if (cleansUp(this)) {
    afterScenario(this, `password:${user.username}`, async () => {
      await setPasswordOf(this, user.username, user.password);
      forgetSession(this, user.username);
    });
  }
  await sendPasswordChange(this, oldPassword === null || oldPassword === undefined ? user.password : oldPassword, first || '', second || '');
});

/**
 * Assert that the password change went through: the admin's "Password change
 * successful" page.
 *
 * Example #1: Then my password should be changed
 * Example #2: And my password should be changed
 * Example #3: Then my password should be changed
 * Example #4: And my password should be changed
 * Example #5: Then my password should be changed
 */
Then(/^my password should be changed$/, async function () {
  if (!(await passwordChanged(this.page))) {
    const errors = await formErrors(this.page);
    throw friendly({ message: `The password was not changed: ${errors.length ? listed(errors) : await pageSummary(this)}.`, hint: 'Change it with: When I change my password to "…"' });
  }
});

/**
 * Assert that the admin refused the password change with an error (or a part
 * of it), on the form or on one of its fields.
 *
 * Example #1: Then the password change should be refused with "Your old password was entered incorrectly. Please enter it again."
 * Example #2: Then the password change should be refused with "The two password fields didn’t match."
 * Example #3: And the password change should be refused with "This password is too common."
 * Example #4: Then the password change should be refused with "This password is entirely numeric."
 * Example #5: And the password change should be refused with "This field is required."
 */
Then(/^the password change should be refused with "([^"]*)"$/, async function (expected) {
  const page = this.page;
  const errors = [...await formErrors(page), ...(await page.locator('#content-main ul.errorlist li').allTextContents().catch(() => [])).map(clean)];
  if ((await passwordChanged(page)) || !errors.some((e) => normal(e).includes(normal(expected)))) {
    throw friendly({
      message: (await passwordChanged(page)) ? 'The password change was not refused: the password was changed.' : `The password change was not refused with "${expected}". Its errors: ${listed(errors)}.`,
      hint: hintFor(this, 'Send the form first: When I try to change my password with …'),
    });
  }
});

/** The page of a user, by a handle of the users registry or a user name. */
async function openUser(world, who) {
  const name = userName(world, who);
  const urls = await findObjects(world, 'Users', name);
  if (!urls.length) {
    throw friendly({ message: `The "Users" list has no "${name}".`, hint: 'The build of the site makes the accounts of the users registry.' });
  }
  await open(world, urls[0]);
  return name;
}

/**
 * Assert an account's status on its page in the admin: staff (it may log in
 * to the admin), a superuser (every permission), active. The account that is
 * logged in must be allowed to see users.
 *
 * Example #1: Then the user "editor" should be staff
 * Example #2: Then the user "editor" should not be a superuser
 * Example #3: And the user "administrator" should be a superuser
 * Example #4: Then the user "viewer" should be active
 * Example #5: And the user "viewer" should not be a superuser
 */
Then(/^the user "([^"]*)" should( not)* be (staff|a superuser|active)$/, async function (who, notCase, status) {
  const name = await openUser(this, who);
  const field = { staff: 'is_staff', 'a superuser': 'is_superuser', active: 'is_active' }[status];
  const box = this.page.locator(`input[name="${field}"]`);
  const readonly = this.page.locator(`.field-${field} .readonly img, .field-${field} .readonly`);
  let on;
  if (await box.count()) on = await box.first().isChecked();
  else if (await readonly.count()) on = /true|yes/i.test((await readonly.first().getAttribute('alt').catch(() => '')) || (await readonly.first().innerText()));
  else throw friendly({ message: `The page of "${name}" has no "${status}" field: ${await pageSummary(this)}.`, hint: 'The account that is logged in must be allowed to see users.' });
  if (on === !!notCase) {
    throw friendly({ message: `The user "${name}" is ${on ? '' : 'not '}${status}.`, hint: 'The build of the site sets the accounts\' status.' });
  }
});

/**
 * Assert that an account is (or is not) in a group, as its page in the admin
 * shows it.
 *
 * Example #1: Then the user "editor" should be in the "Editors" group
 * Example #2: Then the user "viewer" should be in the "Viewers" group
 * Example #3: And the user "editor" should not be in the "Viewers" group
 * Example #4: Then the user "administrator" should not be in the "Editors" group
 * Example #5: And the user "viewer" should not be in the "Editors" group
 */
Then(/^the user "([^"]*)" should( not)* be in the "([^"]*)" group$/, async function (who, notCase, group) {
  const name = await openUser(this, who);
  const page = this.page;
  let groups = (await page.locator('select[name="groups"] option').evaluateAll((os) => os.filter((o) => o.selected || o.closest('select').id.endsWith('_to')).map((o) => o.textContent.trim()))).map(clean);
  if (!groups.length && !(await page.locator('select[name="groups"]').count())) {
    groups = (await page.locator('.field-groups .readonly').allTextContents().catch(() => [])).flatMap((t) => t.split(',')).map(clean).filter(Boolean);
  }
  const has = groups.some((g) => normal(g) === normal(group));
  if (has === !!notCase) {
    throw friendly({ message: notCase ? `The user "${name}" is in the "${group}" group.` : `The user "${name}" is not in the "${group}" group. Its groups: ${listed(groups)}.`, hint: 'The groups of an account are the chosen list of its "Groups" selector.' });
  }
});

/**
 * Assert that a group has (or does not have) a permission, as the group's
 * page in the admin shows it: the permission as the selector lists it
 * ("Polls | question | Can change question"), or its last part ("Can change
 * question").
 *
 * Example #1: Then the "Editors" group should have the "Polls | question | Can change question" permission
 * Example #2: Then the "Viewers" group should have the "Can view question" permission
 * Example #3: And the "Viewers" group should not have the "Can change question" permission
 * Example #4: Then the "Editors" group should not have the "Can delete user" permission
 * Example #5: And the "Editors" group should have the "Can add choice" permission
 */
Then(/^the "([^"]*)" group should( not)* have the "([^"]*)" permission$/, async function (group, notCase, permission) {
  const urls = await findObjects(this, 'Groups', group);
  if (!urls.length) {
    throw friendly({ message: `The "Groups" list has no "${group}".`, hint: 'Write the group as the "Groups" list shows it.' });
  }
  await open(this, urls[0]);
  const page = this.page;
  const chosen = (await page.locator('select[name="permissions"] option').evaluateAll((os) => os.filter((o) => o.selected || o.closest('select').id.endsWith('_to')).map((o) => o.textContent.trim()))).map(clean);
  const has = chosen.some((p) => normal(p) === normal(permission) || normal(p).endsWith('| ' + normal(permission)));
  if (has === !!notCase) {
    throw friendly({ message: notCase ? `The "${group}" group has the "${permission}" permission.` : `The "${group}" group does not have the "${permission}" permission. It has: ${listed(chosen)}.`, hint: 'A group\'s permissions are the chosen list of its "Permissions" selector.' });
  }
});
