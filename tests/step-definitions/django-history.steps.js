'use strict';

// Deleting and the history of an object: the delete confirmation with the
// related objects it would delete (for one object and for "Delete selected …"),
// confirming or going back, the refusal when a protected relation keeps the
// object, and the history page of an object's changes.

const { When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const {
  clean,
  normal,
  listed,
  hintFor,
  open,
  afterNavigation,
  pageSummary,
  eventually,
  findObjects,
  userName,
} = require('./django-helpers');

/** What the delete confirmation on screen lists: its summary and every object, with the related ones. */
async function confirmation(page) {
  return page.evaluate(() => {
    const body = document.body.classList;
    const content = document.getElementById('content');
    if (!content || !body.contains('delete-confirmation')) return null;
    const h1 = content.querySelector('h1');
    // The summary: the list after the heading "Summary".
    const summary = [];
    for (const h2 of content.querySelectorAll('h2')) {
      if (/summary/i.test(h2.textContent)) {
        let el = h2.nextElementSibling;
        while (el && el.tagName !== 'UL') el = el.nextElementSibling;
        if (el) for (const li of el.querySelectorAll(':scope > li')) summary.push(li.textContent.replace(/\s+/g, ' ').trim());
      }
    }
    const objects = [...content.querySelectorAll('#deleted-objects li, ul#deleted-objects li, h2 ~ ul li')]
      .map((li) => (li.firstChild && li.firstChild.nodeType === 3 ? li.firstChild.textContent : '') + (li.querySelector(':scope > a') ? li.querySelector(':scope > a').textContent : ''))
      .map((t) => t.replace(/\s+/g, ' ').trim()).filter(Boolean);
    return {
      heading: h1 ? h1.textContent.replace(/\s+/g, ' ').trim() : '',
      refused: !content.querySelector('form input[name="post"]'),
      summary,
      objects: [...new Set(objects)],
    };
  }).catch(() => null);
}

/** The confirmation on screen, or a failure that says what the page is. */
async function confirmationOrFail(world) {
  const shown = await confirmation(world.page);
  if (shown) return shown;
  throw friendly({ message: `The page is no delete confirmation: ${await pageSummary(world)}.`, hint: hintFor(world, 'Press "Delete" on an object\'s form, or run the action "Delete selected …" on the list.') });
}

/**
 * Assert that the delete confirmation lists (or does not list) an object, as
 * it writes it: the model's name, a colon and the object ("Choice: Yes"). The
 * related objects the deletion takes with it are listed under the object.
 *
 * Example #1: Then the delete confirmation should list "Question: Delete test question"
 * Example #2: Then the delete confirmation should list "Choice: Yes"
 * Example #3: And the delete confirmation should not list "Choice: Maybe"
 * Example #4: Then the delete confirmation should list "Question: Action test question one"
 * Example #5: And the delete confirmation should list "Choice: No"
 */
Then(/^the delete confirmation should( not)* list "([^"]*)"$/, async function (notCase, object) {
  const shown = await confirmationOrFail(this);
  const has = shown.objects.some((o) => normal(o) === normal(object));
  if (has === !!notCase) {
    throw friendly({ message: notCase ? `The delete confirmation lists "${object}".` : `The delete confirmation does not list "${object}". It lists: ${listed(shown.objects)}.`, hint: 'The confirmation writes each object as "<model>: <object>".' });
  }
});

/**
 * Assert a line of the delete confirmation's summary: how many objects of a
 * model the deletion takes ("Choices: 2").
 *
 * Example #1: Then the delete confirmation should count "Questions: 1"
 * Example #2: Then the delete confirmation should count "Choices: 2"
 * Example #3: And the delete confirmation should count "Questions: 2"
 * Example #4: Then the delete confirmation should count "Choices: 4"
 * Example #5: And the delete confirmation should count "Choices: 3"
 */
Then(/^the delete confirmation should count "([^"]*)"$/, async function (line) {
  const shown = await confirmationOrFail(this);
  if (!shown.summary.some((s) => normal(s) === normal(line))) {
    throw friendly({ message: `The delete confirmation's summary has no "${line}". It says: ${listed(shown.summary)}.`, hint: 'The summary counts the objects of each model the deletion takes: "<plural>: <count>".' });
  }
});

/**
 * Confirm the deletion on the delete confirmation ("Yes, I’m sure").
 *
 * Example #1: When I confirm the deletion
 * Example #2: When we confirm the deletion
 * Example #3: And I confirm the deletion
 * Example #4: Then I confirm the deletion
 * Example #5: And we confirm the deletion
 */
When(/^(I |we )*confirm the deletion$/, async function (pronounCase) {
  const shown = await confirmationOrFail(this);
  if (shown.refused) {
    throw friendly({ message: `The deletion cannot be confirmed: the page says "${shown.heading}".`, hint: 'A protected relation keeps the object: the page lists what keeps it.' });
  }
  const page = this.page;
  await afterNavigation(this, () => page.locator('#content form input[name="post"]').locator('xpath=ancestor::form[1]').locator('[type="submit"]').first().click());
});

/**
 * Go back from the delete confirmation without deleting ("No, take me back").
 *
 * Example #1: When I cancel the deletion
 * Example #2: When we cancel the deletion
 * Example #3: And I cancel the deletion
 * Example #4: Then I cancel the deletion
 * Example #5: And we cancel the deletion
 */
When(/^(I |we )*cancel the deletion$/, async function (pronounCase) {
  await confirmationOrFail(this);
  const page = this.page;
  const back = page.locator('#content a.cancel-link');
  if (!(await back.count())) {
    throw friendly({ message: 'The delete confirmation has no "No, take me back" link.', hint: 'The link goes back to the page the deletion was asked from.' });
  }
  await afterNavigation(this, () => back.first().click());
});

/**
 * Assert that the admin refuses to delete the object because a protected
 * relation keeps it (the page "Cannot delete …"), and with "because of" one
 * object it names as keeping it.
 *
 * Example #1: Then the deletion should be refused
 * Example #2: Then the deletion should be refused because of "Question: Which river is the longest?"
 * Example #3: And the deletion should be refused because of "Question: How far is the nearest star?"
 * Example #4: Then the deletion should be refused because of "Question: Delete test question"
 * Example #5: And the deletion should be refused
 */
Then(/^the deletion should be refused(?: because of "([^"]*)")?$/, async function (object) {
  const shown = await confirmationOrFail(this);
  if (!shown.refused) {
    throw friendly({ message: `The deletion is not refused: the page "${shown.heading}" asks to confirm it.`, hint: 'The admin refuses a deletion that a protected relation (on_delete=PROTECT) keeps.' });
  }
  if (object && !shown.objects.some((o) => normal(o) === normal(object))) {
    throw friendly({ message: `The refusal does not name "${object}". It names: ${listed(shown.objects)}.`, hint: 'The refusal writes each object that keeps the deletion as "<model>: <object>".' });
  }
});

/**
 * Delete an object of a model's list, by its text, the way a person does:
 * open it, press "Delete", then confirm.
 *
 * Example #1: When I delete "Delete test question" from the "Questions" list
 * Example #2: When we delete "Inline test question" from the "Questions" list
 * Example #3: And I delete "Reviewers" from the "Groups" list
 * Example #4: When I delete "Test tag" from the "Tags" list
 * Example #5: And we delete "History test question" from the "Questions" list
 */
When(/^(I |we )*delete "([^"]*)" from the "([^"]*)" list$/, async function (pronounCase, object, model) {
  const urls = await findObjects(this, model, object);
  if (!urls.length) {
    throw friendly({ message: `The "${model}" list has no "${object}" to delete.`, hint: 'Write the object as its list shows it in the first column.' });
  }
  await open(this, urls[0]);
  const page = this.page;
  const link = page.locator('.submit-row a.deletelink, a.deletelink');
  if (!(await link.count())) {
    throw friendly({ message: `The page of "${object}" has no "Delete" link: ${await pageSummary(this)}.`, hint: 'The account may not delete objects of this model.' });
  }
  await afterNavigation(this, () => link.first().click());
  const shown = await confirmationOrFail(this);
  if (shown.refused) {
    throw friendly({ message: `The admin refuses to delete "${object}": ${listed(shown.objects)} keep it.`, hint: 'A protected relation keeps the object: delete what keeps it first.' });
  }
  await afterNavigation(this, () => page.locator('#content form input[name="post"]').locator('xpath=ancestor::form[1]').locator('[type="submit"]').first().click());
});

/** The entries of the history page on screen: when, who, what. */
async function historyEntries(page) {
  return page.evaluate(() => [...document.querySelectorAll('#change-history tbody tr')].map((tr) => {
    const cells = [...tr.children].map((c) => c.textContent.replace(/\s+/g, ' ').trim());
    return { when: cells[0] || '', user: cells[1] || '', action: cells[2] || '' };
  })).catch(() => []);
}

/**
 * Open the history of the object whose form is on screen (its "History"
 * link), or of an object of a model's list, by its text.
 *
 * Example #1: When I open the history
 * Example #2: When I open the history of "History test question" in the "Questions" list
 * Example #3: And we open the history
 * Example #4: When we open the history of "editor" in the "Users" list
 * Example #5: And I open the history of "What's up?" in the "Questions" list
 */
When(/^(I |we )*open the history(?: of "([^"]*)" in the "([^"]*)" list)?$/, async function (pronounCase, object, model) {
  const page = this.page;
  if (object) {
    const urls = await findObjects(this, model, object);
    if (!urls.length) throw friendly({ message: `The "${model}" list has no "${object}".`, hint: 'Write the object as its list shows it in the first column.' });
    await open(this, urls[0].replace(/change\/?$/, '') + 'history/');
    return;
  }
  const link = page.locator('.object-tools a.historylink');
  if (!(await link.count())) {
    throw friendly({ message: `The page has no "History" link: ${await pageSummary(this)}.`, hint: hintFor(this, 'Open an object\'s form first.') });
  }
  await afterNavigation(this, () => link.first().click());
});

/**
 * Assert that the history lists (or does not list) an entry: what was done,
 * as the admin writes it ("Added.", "Changed Question text."), and with "by"
 * the account (a handle of the users registry or a user name).
 *
 * Example #1: Then the history should list "Added."
 * Example #2: Then the history should list "Changed Question text." by "editor"
 * Example #3: And the history should list "Added choice “Yes”." by "administrator"
 * Example #4: Then the history should not list "Deleted choice"
 * Example #5: And the history should list "Added." by "editor"
 */
Then(/^the history should( not)* list "([^"]*)"(?: by "([^"]*)")?$/, async function (notCase, action, who) {
  const page = this.page;
  if (!(await page.locator('#change-history').count())) {
    throw friendly({ message: `The page is no history page: ${await pageSummary(this)}.`, hint: 'Open it with: When I open the history' });
  }
  const entries = await historyEntries(page);
  const user = who ? userName(this, who) : null;
  const has = entries.some((e) => normal(e.action).includes(normal(action)) && (!user || normal(e.user) === normal(user)));
  if (has === !!notCase) {
    throw friendly({
      message: notCase ? `The history lists "${action}"${user ? ` by "${user}"` : ''}.` : `The history does not list "${action}"${user ? ` by "${user}"` : ''}. It lists: ${listed(entries.map((e) => `${e.action} (${e.user})`))}.`,
      hint: 'The history lists every change made through the admin, oldest first.',
    });
  }
});

/**
 * Assert how many entries the history of an object has.
 *
 * Example #1: Then the history should have 1 entry
 * Example #2: Then the history should have 2 entries
 * Example #3: And the history should have 3 entries
 * Example #4: Then the history should have 2 entries
 * Example #5: And the history should have 1 entry
 */
Then(/^the history should have (\d+) entr(?:y|ies)$/, async function (expected) {
  const page = this.page;
  const entries = await eventually(this, () => historyEntries(page), () => true, () => ({ message: '' }), 1);
  if (entries.length !== parseInt(expected, 10)) {
    throw friendly({ message: `The history has ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}, not ${expected}: ${listed(entries.map((e) => e.action))}.`, hint: 'Each save through the admin adds an entry.' });
  }
});

module.exports = { confirmation, clean };
