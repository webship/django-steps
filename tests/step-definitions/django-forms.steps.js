'use strict';

// The add and change forms: opening them, every kind of field by its label (a
// text, a list, a box, a date and time, an autocomplete field, a two-list
// selector), read-only fields, the sections (fieldsets) and the ones that fold,
// saving with the three buttons, the messages after saving, the errors of a
// refused form, and the view-only form.

const { When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const {
  budget,
  clean,
  normal,
  listed,
  escapeRegExp,
  absolute,
  hintFor,
  open,
  afterNavigation,
  heading,
  pageSummary,
  eventually,
  messages,
  formErrors,
  modelListUrl,
  findObjects,
  fieldOrFail,
  mainForm,
  setField,
  readField,
  selectorParts,
  optionTexts,
  moveInSelector,
} = require('./django-helpers');

/** Fail unless the page shows a form of the admin (an add, change or view form). */
async function formOrFail(world) {
  const form = mainForm(world.page);
  if (await world.page.locator('body.change-form').count()) return form;
  throw friendly({ message: `The page is no add or change form of the admin: ${await pageSummary(world)}.`, hint: hintFor(world, 'Open one first: When I open the add form of "Questions", or When I open "What\'s up?" in the "Questions" list') });
}

/**
 * Open the add form of a model, by the model's plural name as the admin index
 * shows it ("Questions").
 *
 * Example #1: When I open the add form of "Questions"
 * Example #2: When we open the add form of "Tags"
 * Example #3: And I open the add form of "Groups"
 * Example #4: When I open the add form of "Categories"
 * Example #5: Given I open the add form of "Questions"
 */
When(/^(I |we )*open the add form of "([^"]*)"$/, async function (pronounCase, model) {
  const list = await modelListUrl(this, model);
  const response = await open(this, list + 'add/');
  if (response && response.status() >= 400) {
    throw friendly({ message: `The add form of "${model}" answered with HTTP ${response.status()}: ${await pageSummary(this)}.`, hint: 'The account that is logged in may not add to this list.' });
  }
});

/**
 * Open an object's page from the change list on screen: its link in the
 * first column (the change form, or the view form for an account that may
 * only view).
 *
 * Example #1: When I open "Which river is the longest?" from the list
 * Example #2: When we open "editor" from the list
 * Example #3: And I open "What's up?" from the list
 * Example #4: When I open "Science" from the list
 * Example #5: And we open "Which breakfast keeps you going?" from the list
 */
When(/^(I |we )*open "([^"]*)" from the list$/, async function (pronounCase, object) {
  const page = this.page;
  const link = page.locator('#result_list tbody tr').locator('th a, td.field-__str__ a').filter({ hasText: new RegExp('^\\s*' + escapeRegExp(clean(object)) + '\\s*$') });
  if (!(await link.count())) {
    const shown = (await page.locator('#result_list tbody tr').evaluateAll((rows) => rows.map((r) => ((r.querySelector('th') || r).textContent || '').replace(/\s+/g, ' ').trim()))).filter(Boolean);
    throw friendly({ message: `The list has no row "${object}" on this page. It shows: ${listed(shown)}.`, hint: hintFor(this, 'Search for the row, or go to its page, first.') });
  }
  await afterNavigation(this, () => link.first().click());
});

/**
 * Open an object's page from a model's list, by the object's text: the list
 * is searched for it as a person would, then its link followed.
 *
 * Example #1: When I open "What's up?" in the "Questions" list
 * Example #2: When we open "editor" in the "Users" list
 * Example #3: And I open "Editors" in the "Groups" list
 * Example #4: Given I open "Science" in the "Categories" list
 * Example #5: When I open "Which river is the longest?" in the "Questions" list
 */
When(/^(I |we )*open "([^"]*)" in the "([^"]*)" list$/, async function (pronounCase, object, model) {
  const urls = await findObjects(this, model, object);
  if (!urls.length) {
    throw friendly({ message: `The "${model}" list has no "${object}".`, hint: 'Write the object as its list shows it in the first column.' });
  }
  const response = await open(this, urls[0]);
  if (response && response.status() >= 400) {
    throw friendly({ message: `The page of "${object}" answered with HTTP ${response.status()}: ${await pageSummary(this)}.`, hint: 'The account that is logged in may not see this object.' });
  }
});

/**
 * Set a field of the form, found by its label as the form shows it (the colon
 * left out), whatever its kind: a text; a list (the option's text); a box
 * ("yes" or "no"); a date ("2026-01-15", "today"); a time ("10:30:00",
 * "now"); a date and time ("2026-01-15 10:30:00", or "now" for the
 * shortcuts "Today" and "Now"); an autocomplete field (the object's text: the
 * step types it and chooses the answer); a two-list selector ("Fun, Serious":
 * exactly those chosen).
 *
 * Example #1: When I set "Question text" to "Who is there?"
 * Example #2: When I set "Date published" to "2026-01-15 10:30:00"
 * Example #3: And I set "Category" to "Science"
 * Example #4: And we set "Tags" to "Fun, Serious"
 * Example #5: When I set "Date published" to "now"
 */
When(/^(I |we )*set "([^"]*)" to "([^"]*)"$/, { timeout: 60000 }, async function (pronounCase, label, value) {
  const form = await formOrFail(this);
  await setField(this, form, label, value);
});

/**
 * Set several fields of the form at once, from a table of labels and values
 * (see "I set "…" to "…"" for the values each kind of field takes).
 *
 * Example #1: When I set these fields:
 * Example #2: And I set these fields:
 * Example #3: When we set these fields:
 * Example #4: And we set these fields:
 * Example #5: Given I set these fields:
 */
When(/^(I |we )*set these fields:$/, { timeout: 120000 }, async function (pronounCase, table) {
  const form = await formOrFail(this);
  for (const [label, value] of table.raw()) {
    await setField(this, form, label, value);
  }
});

/**
 * Assert what a field of the form holds, found by its label: the text, the
 * chosen option, "yes" or "no" for a box, "2026-01-15 10:30:00" for a date
 * and time, the chosen object of an autocomplete field, "Fun, Serious" for a
 * selector's chosen options, the text of a read-only field.
 *
 * Example #1: Then "Question text" should be set to "Who is there?"
 * Example #2: Then "Category" should be set to "Science"
 * Example #3: And "Tags" should be set to "Fun, Serious"
 * Example #4: Then "Staff status" should be set to "yes"
 * Example #5: And "Date published" should be set to "2025-01-06 09:00:00"
 */
Then(/^"([^"]*)" should be set to "([^"]*)"$/, async function (label, expected) {
  const form = await formOrFail(this);
  await eventually(this, () => readField(this, form, label), (value) => normal(value) === normal(expected),
    (value) => ({ message: `The field "${label}" holds "${value}", not "${expected}".`, hint: 'A list of options reads "A, B"; a box reads "yes" or "no".' }), 3000);
});

/**
 * Assert that a field of the form is read-only (the admin shows its value as
 * text, with no input), and with "and show" what it shows.
 *
 * Example #1: Then "Total votes" should be read-only
 * Example #2: Then "Total votes" should be read-only and show "0"
 * Example #3: And "Total votes" should be read-only and show "8"
 * Example #4: Then "Question text" should be read-only and show "What's up?"
 * Example #5: And "Category" should be read-only and show "Food"
 */
Then(/^"([^"]*)" should be read-only(?: and show "([^"]*)")?$/, async function (label, expected) {
  const form = await formOrFail(this);
  const field = await fieldOrFail(this, form, label);
  if (field.kind !== 'readonly') {
    throw friendly({ message: `The field "${label}" is not read-only: it is an input (${field.kind}).`, hint: 'The admin shows a read-only field (readonly_fields, or a form the account may only view) as text.' });
  }
  if (expected !== null && expected !== undefined) {
    const shown = clean(await field.box.locator('.readonly').first().innerText());
    if (normal(shown) !== normal(expected)) {
      throw friendly({ message: `The read-only field "${label}" shows "${shown}", not "${expected}".`, hint: 'An empty value shows as "-".' });
    }
  }
});

/** The sections (fieldsets) of the form: their headings and whether each folds and is open. */
async function sections(page) {
  return page.evaluate(() => [...document.querySelectorAll('#content-main form fieldset.module')]
    .filter((f) => !f.closest('.inline-group'))
    .map((f) => {
      const h = f.querySelector(':scope > h2, :scope > details > summary h2, :scope > details > summary');
      const details = f.querySelector(':scope > details');
      return {
        title: h ? h.textContent.replace(/\s+/g, ' ').trim() : '',
        folds: f.classList.contains('collapse'),
        open: details ? details.open : true,
        fields: [...f.querySelectorAll('label, legend')].filter((l) => !l.closest('p.datetime, .selector, .help, .datetimeshortcuts'))
          .map((l) => l.textContent.replace(/\s+/g, ' ').trim().replace(/\s*:$/, '')).filter(Boolean),
      };
    })).catch(() => []);
}

/**
 * Assert that the form has (or does not have) a section, by its heading.
 *
 * Example #1: Then the form should have the section "Classification"
 * Example #2: Then the form should have the section "Date information"
 * Example #3: And the form should not have the section "Advanced options"
 * Example #4: Then the form should have the section "Personal info"
 * Example #5: And the form should have the section "Permissions"
 */
Then(/^the form should( not)* have the section "([^"]*)"$/, async function (notCase, title) {
  await formOrFail(this);
  const all = await sections(this.page);
  const has = all.some((s) => normal(s.title) === normal(title));
  if (has === !!notCase) {
    throw friendly({ message: notCase ? `The form has the section "${title}".` : `The form has no section "${title}". Its sections: ${listed(all.map((s) => s.title))}.`, hint: 'The sections are the model admin\'s fieldsets; the first often has no heading.' });
  }
});

/**
 * Assert that a section of the form has (or does not have) a field, by its
 * label.
 *
 * Example #1: Then the section "Classification" should have the field "Category"
 * Example #2: Then the section "Date information" should have the field "Date published"
 * Example #3: And the section "Classification" should not have the field "Question text"
 * Example #4: Then the section "Permissions" should have the field "Groups"
 * Example #5: And the section "Results" should have the field "Total votes"
 */
Then(/^the section "([^"]*)" should( not)* have the field "([^"]*)"$/, async function (title, notCase, label) {
  await formOrFail(this);
  const all = await sections(this.page);
  const section = all.find((s) => normal(s.title) === normal(title));
  if (!section) {
    throw friendly({ message: `The form has no section "${title}". Its sections: ${listed(all.map((s) => s.title))}.`, hint: 'Name a section by its heading.' });
  }
  const has = section.fields.some((f) => normal(f) === normal(label));
  if (has === !!notCase) {
    throw friendly({ message: notCase ? `The section "${title}" has the field "${label}".` : `The section "${title}" has no field "${label}". Its fields: ${listed(section.fields)}.`, hint: 'Name a field by its label, without the colon.' });
  }
});

/**
 * Open or close a section of the form that folds (a fieldset with the class
 * "collapse"), with its heading, as a person does.
 *
 * Example #1: When I open the section "Date information"
 * Example #2: When I close the section "Date information"
 * Example #3: And we open the section "Date information"
 * Example #4: When we close the section "Date information"
 * Example #5: And I open the section "Date information"
 */
When(/^(I |we )*(open|close) the section "([^"]*)"$/, async function (pronounCase, verb, title) {
  await formOrFail(this);
  const page = this.page;
  const all = await sections(page);
  const section = all.find((s) => normal(s.title) === normal(title));
  if (!section) {
    throw friendly({ message: `The form has no section "${title}". Its sections: ${listed(all.map((s) => s.title))}.`, hint: 'Name a section by its heading.' });
  }
  if (!section.folds) {
    throw friendly({ message: `The section "${title}" does not fold: it is always open.`, hint: 'A section folds when its fieldset has the class "collapse".' });
  }
  if (section.open === (verb === 'open')) return;
  const summary = page.locator('#content-main form fieldset.collapse > details > summary').filter({ hasText: new RegExp('^\\s*' + escapeRegExp(clean(title)) + '\\s*$') });
  if (!(await summary.count())) {
    throw friendly({ message: `The section "${title}" shows open and cannot be folded now (a section with an error stays open).`, hint: 'The admin opens a folded section when a field in it has an error.' });
  }
  await summary.first().click();
  await eventually(this, async () => (await sections(page)).find((s) => normal(s.title) === normal(title)), (s) => s && s.open === (verb === 'open'),
    () => ({ message: `The section "${title}" did not ${verb}.`, hint: 'The heading of a folding section opens and closes it.' }), 3000);
});

/**
 * Assert that a section of the form that folds is open or closed.
 *
 * Example #1: Then the section "Date information" should be closed
 * Example #2: Then the section "Date information" should be open
 * Example #3: And the section "Date information" should be closed
 * Example #4: Then the section "Classification" should be open
 * Example #5: And the section "Date information" should be open
 */
Then(/^the section "([^"]*)" should be (open|closed)$/, async function (title, state) {
  await formOrFail(this);
  const all = await sections(this.page);
  const section = all.find((s) => normal(s.title) === normal(title));
  if (!section) {
    throw friendly({ message: `The form has no section "${title}". Its sections: ${listed(all.map((s) => s.title))}.`, hint: 'Name a section by its heading.' });
  }
  if (section.open !== (state === 'open')) {
    throw friendly({ message: `The section "${title}" is ${section.open ? 'open' : 'closed'}, not ${state}.`, hint: `It folds with its heading: When I ${state === 'open' ? 'open' : 'close'} the section "${title}"` });
  }
});

/** An autocomplete field of the form, by its label, or a failure. */
async function autocompleteField(world, label) {
  const form = await formOrFail(world);
  const field = await fieldOrFail(world, form, label);
  if (field.kind !== 'autocomplete') {
    throw friendly({ message: `The field "${label}" is no autocomplete field (it is ${field.kind}).`, hint: 'An autocomplete field is a box that searches as you type (autocomplete_fields).' });
  }
  return field;
}

/**
 * Type a text in an autocomplete field, without choosing: the field opens its
 * list of answers and the step waits for the admin's answer to that text.
 * Check the answers with the next step.
 *
 * Example #1: When I type "Sci" in the "Category" autocomplete
 * Example #2: When we type "Tra" in the "Category" autocomplete
 * Example #3: And I type "zzz" in the "Category" autocomplete
 * Example #4: When I type "S" in the "Category" autocomplete
 * Example #5: And we type "Food" in the "Category" autocomplete
 */
When(/^(I |we )*type "([^"]*)" in the "([^"]*)" autocomplete$/, async function (pronounCase, text, label) {
  const field = await autocompleteField(this, label);
  const page = this.page;
  const id = await field.box.locator('select.admin-autocomplete').first().getAttribute('id');
  if (!(await page.locator('.select2-container--open .select2-search__field').count())) await field.box.locator('.select2-selection').first().click();
  const search = page.locator('.select2-container--open .select2-search__field');
  await search.waitFor({ state: 'visible', timeout: budget(this) });
  const answered = page.waitForResponse((r) => {
    try { const u = new URL(r.url()); return /\/autocomplete\/?$/.test(u.pathname) && u.searchParams.get('term') === text; } catch { return false; }
  }, { timeout: budget(this) }).catch(() => null);
  await search.fill(text);
  await answered;
  await page.waitForFunction((rid) => { const l = document.getElementById(rid); return !!l && !l.querySelector('.loading-results'); }, `select2-${id}-results`, { timeout: budget(this) }).catch(() => {});
  this.__autocompleteOpen = id;
});

/**
 * Assert that the open autocomplete field offers (or does not offer) an
 * answer, after "I type "…" in the "…" autocomplete".
 *
 * Example #1: Then the "Category" autocomplete should offer "Science"
 * Example #2: Then the "Category" autocomplete should not offer "Travel"
 * Example #3: And the "Category" autocomplete should offer "Travel"
 * Example #4: Then the "Category" autocomplete should not offer "Science"
 * Example #5: And the "Category" autocomplete should offer "Food"
 */
Then(/^the "([^"]*)" autocomplete should( not)* offer "([^"]*)"$/, async function (label, notCase, value) {
  const field = await autocompleteField(this, label);
  const id = await field.box.locator('select.admin-autocomplete').first().getAttribute('id');
  const offered = (await this.page.locator(`#select2-${id}-results li.select2-results__option`).allTextContents().catch(() => [])).map(clean);
  const has = offered.some((o) => normal(o) === normal(value));
  if (has === !!notCase) {
    throw friendly({ message: notCase ? `The "${label}" autocomplete offers "${value}".` : `The "${label}" autocomplete does not offer "${value}". It offers: ${listed(offered)}.`, hint: `Type in it first: When I type "${value.slice(0, 3)}" in the "${label}" autocomplete` });
  }
});

/**
 * Choose an object in an autocomplete field, by its text: the step opens the
 * field, types the text, waits for the admin's answer and chooses the answer
 * that is exactly that text.
 *
 * Example #1: When I choose "Science" in the "Category" autocomplete
 * Example #2: When we choose "Travel" in the "Category" autocomplete
 * Example #3: And I choose "Food" in the "Category" autocomplete
 * Example #4: When I choose "Music" in the "Category" autocomplete
 * Example #5: And we choose "Sport" in the "Category" autocomplete
 */
When(/^(I |we )*choose "([^"]*)" in the "([^"]*)" autocomplete$/, { timeout: 60000 }, async function (pronounCase, value, label) {
  await autocompleteField(this, label);
  const form = mainForm(this.page);
  if (await this.page.locator('.select2-container--open').count()) await this.page.keyboard.press('Escape');
  await setField(this, form, label, value);
});

/** A two-list selector of the form, by its label ("Tags", "Permissions"), or a failure. */
async function selectorField(world, label) {
  const form = await formOrFail(world);
  const field = await fieldOrFail(world, form, label);
  if (field.kind !== 'selector') {
    throw friendly({ message: `The field "${label}" is no two-list selector (it is ${field.kind}).`, hint: 'A two-list selector has the lists "Available …" and "Chosen …" (filter_horizontal, filter_vertical).' });
  }
  return field;
}

/**
 * Move options of a two-list selector, by their texts ("Fun", or "Fun,
 * Serious"): "choose" from the available list to the chosen one with the
 * "Choose" button, "remove" from the chosen list with the "Remove" button.
 *
 * Example #1: When I choose "Fun" in the "Tags" selector
 * Example #2: When I remove "Fun" from the "Tags" selector
 * Example #3: And we choose "Fun, Serious" in the "Tags" selector
 * Example #4: When I choose "Polls | question | Can change question" in the "Permissions" selector
 * Example #5: And I remove "Serious" from the "Tags" selector
 */
When(/^(I |we )*(?:choose "([^"]*)" in|remove "([^"]*)" from) the "([^"]*)" selector$/, async function (pronounCase, chosen, removed, label) {
  const field = await selectorField(this, label);
  // Cucumber gives null for the half of the phrase that is not there.
  const choosing = chosen !== null && chosen !== undefined;
  const values = String(choosing ? chosen : removed).split(',').map(clean).filter(Boolean);
  await moveInSelector(this, field.box, values, choosing ? 'choose' : 'remove', label);
});

/**
 * Move every option of a two-list selector at once, with its "Choose all" or
 * "Remove all" button.
 *
 * Example #1: When I choose all in the "Tags" selector
 * Example #2: When I remove all from the "Tags" selector
 * Example #3: And we choose all in the "Tags" selector
 * Example #4: When we remove all from the "Tags" selector
 * Example #5: And I remove all from the "Tags" selector
 */
When(/^(I |we )*(choose all in|remove all from) the "([^"]*)" selector$/, async function (pronounCase, verb, label) {
  const field = await selectorField(this, label);
  const parts = selectorParts(field.box);
  const all = verb.startsWith('choose');
  const button = all ? parts.addAll : parts.removeAll;
  if (await button.isDisabled().catch(() => false)) return; // nothing to move
  await button.click();
  await eventually(this, () => optionTexts(all ? parts.from : parts.to), (left) => left.length === 0,
    (left) => ({ message: `After "${all ? 'Choose all' : 'Remove all'}" the ${all ? 'available' : 'chosen'} "${label}" still list ${listed(left)}.`, hint: 'The button moves the options the filter shows.' }), 3000);
});

/**
 * Filter the available list of a two-list selector with its filter box: it
 * shows only the options with the text.
 *
 * Example #1: When I filter the available "Tags" with "Fu"
 * Example #2: When we filter the available "Permissions" with "question"
 * Example #3: And I filter the available "Tags" with ""
 * Example #4: When I filter the available "Groups" with "Edit"
 * Example #5: And we filter the available "Tags" with "Ser"
 */
When(/^(I |we )*filter the available "([^"]*)" with "([^"]*)"$/, async function (pronounCase, label, text) {
  const field = await selectorField(this, label);
  const parts = selectorParts(field.box);
  await parts.filter.fill('');
  if (text) await parts.filter.pressSequentially(text);
  else await parts.filter.press('Backspace').catch(() => {});
});

/**
 * Assert where an option of a two-list selector is: in the "chosen" list or
 * the "available" one (as its filter shows it).
 *
 * Example #1: Then the "Tags" selector should have "Fun" chosen
 * Example #2: Then the "Tags" selector should have "Long" available
 * Example #3: And the "Tags" selector should not have "Fun" available
 * Example #4: Then the "Permissions" selector should have "Polls | question | Can change question" chosen
 * Example #5: And the "Tags" selector should not have "Serious" chosen
 */
Then(/^the "([^"]*)" selector should( not)* have "([^"]*)" (chosen|available)$/, async function (label, notCase, value, list) {
  const field = await selectorField(this, label);
  const parts = selectorParts(field.box);
  const options = await (list === 'chosen' ? parts.to : parts.from).locator('option').evaluateAll((opts) => opts.filter((o) => o.style.display !== 'none' && !o.hidden).map((o) => o.textContent.replace(/\s+/g, ' ').trim()));
  const has = options.some((o) => normal(o) === normal(value));
  if (has === !!notCase) {
    throw friendly({ message: notCase ? `The ${list} "${label}" list "${value}".` : `The ${list} "${label}" do not list "${value}". They list: ${listed(options)}.`, hint: list === 'available' ? 'The filter box of the available list hides the options without its text.' : 'Choose it with: When I choose "' + value + '" in the "' + label + '" selector' });
  }
});

/**
 * Save the form with one of its three buttons: "Save" (back to the list),
 * "Save and add another" (a new add form) or "Save and continue editing"
 * (the same form again). The step waits for the next page; a form the admin
 * refuses comes back with its errors (check them with the error steps).
 *
 * Example #1: When I save the form
 * Example #2: When I save the form and add another
 * Example #3: When I save the form and continue editing
 * Example #4: And we save the form
 * Example #5: And we save the form and continue editing
 */
When(/^(I |we )*save the form( and add another| and continue editing)?$/, async function (pronounCase, which) {
  await formOrFail(this);
  const page = this.page;
  const name = !which ? '_save' : which.includes('another') ? '_addanother' : '_continue';
  const button = page.locator(`.submit-row [name="${name}"]`);
  if (!(await button.count())) {
    const offered = await page.locator('.submit-row [type="submit"]').evaluateAll((bs) => bs.map((b) => b.value || b.textContent.trim()));
    throw friendly({ message: `The form has no button "${!which ? 'Save' : which.includes('another') ? 'Save and add another' : 'Save and continue editing'}". Its buttons: ${listed(offered)}.`, hint: 'A form the account may only view has no save buttons.' });
  }
  await afterNavigation(this, () => button.first().click());
});

/**
 * Assert that the last save went through: the admin shows its success
 * message and no error.
 *
 * Example #1: Then the form should be saved
 * Example #2: And the form should be saved
 * Example #3: Then the form should be saved
 * Example #4: And the form should be saved
 * Example #5: Then the form should be saved
 */
Then(/^the form should be saved$/, async function () {
  const page = this.page;
  const ok = await messages(page, 'success');
  const errors = await formErrors(page);
  if (!ok.length || errors.length) {
    throw friendly({
      message: errors.length ? `The admin refused the form: ${listed(errors)}.` : `The admin shows no success message: ${await pageSummary(this)}.`,
      hint: hintFor(this, 'Save it first: When I save the form; the fields with an error say why.'),
    });
  }
});

/**
 * Assert the messages the admin shows above a page after an action: success,
 * warning, error or info, by their text or a part of it (straight quotes match
 * the admin's typographic ones).
 *
 * Example #1: Then I should see the success message "The question “What is new?” was added successfully."
 * Example #2: Then I should see the success message "was changed successfully"
 * Example #3: And I should see the warning message "No action selected."
 * Example #4: Then I should not see the error message "Please correct the error below."
 * Example #5: And we should see the success message "Successfully deleted 2 questions."
 */
Then(/^(I |we )*should( not)* see the (success|warning|error|info) message "([^"]*)"$/, async function (pronounCase, notCase, kind, expected) {
  const page = this.page;
  const read = () => messages(page, kind);
  const has = (lines) => lines.some((line) => normal(line).includes(normal(expected)));
  if (notCase) {
    const lines = await read();
    if (has(lines)) throw friendly({ message: `The admin shows the ${kind} message "${lines.find((l) => normal(l).includes(normal(expected)))}".`, hint: 'The messages show above the page after an action.' });
    return;
  }
  await eventually(this, read, has, async (lines) => ({
    message: `The admin shows no ${kind} message "${expected}". Its ${kind} messages: ${listed(lines)}; all messages: ${listed(await messages(page, 'any'))}.`,
    hint: hintFor(this, 'The admin shows its messages above the page after an action.'),
  }), 3000);
});

/**
 * Assert the error of one field of a refused form, by the field's label (or a
 * part of the error).
 *
 * Example #1: Then the field "Question text" should have the error "This field is required."
 * Example #2: Then the field "Date published" should have the error "This field is required."
 * Example #3: And the field "Name" should have the error "Group with this Name already exists."
 * Example #4: Then the field "Question text" should not have the error "This field is required."
 * Example #5: And the field "New password confirmation" should have the error "The two password fields didn’t match."
 */
Then(/^the field "([^"]*)" should( not)* have the error "([^"]*)"$/, async function (label, notCase, expected) {
  const page = this.page;
  const form = mainForm(page);
  const field = await fieldOrFail(this, form, label);
  // The error list sits in the field's row, before or beside the input.
  const row = field.box.locator('xpath=ancestor-or-self::*[contains(concat(" ", normalize-space(@class), " "), " form-row ")][1]');
  const scope = (await row.count()) ? row : field.box;
  const errors = (await scope.locator('ul.errorlist li').allTextContents().catch(() => [])).map(clean);
  const has = errors.some((e) => normal(e).includes(normal(expected)));
  if (has === !!notCase) {
    throw friendly({ message: notCase ? `The field "${label}" has the error "${expected}".` : `The field "${label}" does not have the error "${expected}". Its errors: ${listed(errors)}.`, hint: 'The admin writes a field\'s errors in its row, after the form was sent.' });
  }
});

/**
 * Assert the error the admin writes above a refused form (its error note,
 * "Please correct the error below.", or an error of the whole form).
 *
 * Example #1: Then the form should show the error "Please correct the errors below."
 * Example #2: Then the form should show the error "Please correct the error below."
 * Example #3: And the form should show the error "Please correct"
 * Example #4: Then the form should not show the error "Please correct the errors below."
 * Example #5: And the form should show the error "Please correct the errors below."
 */
Then(/^the form should( not)* show the error "([^"]*)"$/, async function (notCase, expected) {
  const errors = await formErrors(this.page);
  const has = errors.some((e) => normal(e).includes(normal(expected)));
  if (has === !!notCase) {
    throw friendly({ message: notCase ? `The form shows the error "${expected}".` : `The form does not show the error "${expected}". Its errors: ${listed(errors)}; ${await pageSummary(this)}.`, hint: hintFor(this, 'Send the form first: When I save the form') });
  }
});

/**
 * Assert that the form on screen has no error at all.
 *
 * Example #1: Then the form should have no errors
 * Example #2: And the form should have no errors
 * Example #3: Then the form should have no errors
 * Example #4: And the form should have no errors
 * Example #5: Then the form should have no errors
 */
Then(/^the form should have no errors$/, async function () {
  const page = this.page;
  const errors = [...await formErrors(page), ...(await page.locator('#content-main ul.errorlist li').allTextContents().catch(() => [])).map(clean)].filter(Boolean);
  if (errors.length) {
    throw friendly({ message: `The form has errors: ${listed(errors)}.`, hint: 'The fields with an error say why.' });
  }
});

/**
 * Assert which form of the admin the page is, by its heading ("Add question",
 * "Change question", "View question"), and with "for" the object it is the
 * form of.
 *
 * Example #1: Then I should see the "Add question" form
 * Example #2: Then I should see the "Change question" form for "What's up?"
 * Example #3: And I should see the "View question" form for "What's up?"
 * Example #4: Then we should see the "Change user" form for "editor"
 * Example #5: And I should see the "Add group" form
 */
Then(/^(I |we )*should see the "([^"]*)" form(?: for "([^"]*)")?$/, async function (pronounCase, form, object) {
  const page = this.page;
  const read = async () => ({ h1: await heading(page), title: clean(await page.title()) });
  await eventually(this, read, (v) => normal(v.h1) === normal(form) && (!object || normal(v.title).startsWith(normal(object) + ' |')),
    async (v) => ({ message: `The page is ${v.h1 ? `the "${v.h1}" form` : 'no form'}${object ? ` (title "${v.title}")` : ''}, not the "${form}" form${object ? ` for "${object}"` : ''}: ${await pageSummary(this)}.`, hint: hintFor(this, 'The admin titles a form by what it does and the model: "Add question", "Change question", "View question".') }));
});

/**
 * Assert that the form on screen is (or is not) read-only: a form the account
 * may only view shows its values as text and has no save buttons.
 *
 * Example #1: Then the form should be read-only
 * Example #2: Then the form should not be read-only
 * Example #3: And the form should be read-only
 * Example #4: Then the form should not be read-only
 * Example #5: And the form should be read-only
 */
Then(/^the form should( not)* be read-only$/, async function (notCase) {
  await formOrFail(this);
  const page = this.page;
  const saves = await page.locator('.submit-row [name="_save"], .submit-row [name="_continue"], .submit-row [name="_addanother"]').count();
  const inputs = await page.locator('#content-main form .form-row').locator('input:not([type=hidden]), select, textarea').count();
  const readOnly = saves === 0 && inputs === 0;
  if (readOnly === !!notCase) {
    throw friendly({ message: notCase ? 'The form is read-only: no save button, no input.' : `The form is not read-only: ${saves} save button${saves === 1 ? '' : 's'}, ${inputs} input${inputs === 1 ? '' : 's'}.`, hint: 'An account with only the view permission gets the form as text, with a "Close" button.' });
  }
});

module.exports = { formOrFail, absolute };
