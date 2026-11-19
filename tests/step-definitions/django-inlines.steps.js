'use strict';

// The inline rows of a form: the objects edited on the page of another (the
// choices of a question), in a table (tabular) or one under another (stacked):
// how many rows, adding a row, removing one, setting and reading a field of a
// row, and what the rows list.

const { When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const {
  clean,
  normal,
  listed,
  eventually,
  setField,
  readField,
  inlineGroup,
  inlineRows,
  inlineRow,
} = require('./django-helpers');

/** How many rows an inline group shows (saved and new; the hidden template left out). */
async function rowCount(inline) {
  return inlineRows(inline).count();
}

/** Every value a row shows: its inputs' values, its chosen options, its texts. */
async function rowValues(row) {
  return row.evaluate((r) => {
    const out = [];
    for (const el of r.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]), textarea')) if (el.value) out.push(el.value);
    for (const el of r.querySelectorAll('select')) for (const o of el.selectedOptions) if (o.value) out.push(o.textContent);
    for (const el of r.querySelectorAll('.readonly, td.original p, td.field-__str__, td p')) if (el.textContent.trim()) out.push(el.textContent);
    return out.map((t) => t.replace(/\s+/g, ' ').trim()).filter(Boolean);
  });
}

/**
 * Assert how many rows an inline shows, by its heading ("Choices"): the saved
 * rows and the new ones, the template the admin copies new rows from left out.
 *
 * Example #1: Then the "Choices" inline should have 3 rows
 * Example #2: Then the "Choices" inline should have 4 rows
 * Example #3: And the "Questions" inline should have 1 row
 * Example #4: Then the "Choices" inline should have 2 rows
 * Example #5: And the "Questions" inline should have 5 rows
 */
Then(/^the "([^"]*)" inline should have (\d+) rows?$/, async function (name, expected) {
  const inline = await inlineGroup(this, name);
  await eventually(this, () => rowCount(inline), (n) => n === parseInt(expected, 10),
    (n) => ({ message: `The inline "${name}" has ${n} row${n === 1 ? '' : 's'}, not ${expected}.`, hint: 'A new form shows the extra rows of the inline (extra); "Add another …" adds one, "Remove" takes a new one away.' }), 3000);
});

/**
 * Add a row to an inline with its "Add another …" link, as a person does.
 *
 * Example #1: When I add a row to the "Choices" inline
 * Example #2: When we add a row to the "Choices" inline
 * Example #3: And I add a row to the "Questions" inline
 * Example #4: When I add a row to the "Choices" inline
 * Example #5: And we add a row to the "Questions" inline
 */
When(/^(I |we )*add a row to the "([^"]*)" inline$/, async function (pronounCase, name) {
  const inline = await inlineGroup(this, name);
  const before = await rowCount(inline);
  const link = inline.group.locator('.add-row a');
  if (!(await link.count()) || !(await link.first().isVisible())) {
    throw friendly({ message: `The inline "${name}" offers no "Add another" link: it has as many rows as it may (max_num), or the account may not add to it.`, hint: 'The admin hides the link when the inline is full.' });
  }
  await link.first().click();
  await eventually(this, () => rowCount(inline), (n) => n === before + 1,
    (n) => ({ message: `After "Add another" the inline "${name}" has ${n} rows (it had ${before}).`, hint: 'The admin\'s inline script adds the row.' }), 3000);
});

/**
 * Remove a row of an inline, by its number from 1: a new row goes away with
 * its "Remove" link; a saved row is marked for deletion with its "Delete" box
 * (it is deleted when the form is saved).
 *
 * Example #1: When I remove row 4 of the "Choices" inline
 * Example #2: When I remove row 2 of the "Choices" inline
 * Example #3: And we remove row 1 of the "Questions" inline
 * Example #4: When we remove row 3 of the "Choices" inline
 * Example #5: And I remove row 1 of the "Choices" inline
 */
When(/^(I |we )*remove row (\d+) of the "([^"]*)" inline$/, async function (pronounCase, number, name) {
  const inline = await inlineGroup(this, name);
  const row = await inlineRow(this, inline, parseInt(number, 10), name);
  const before = await rowCount(inline);
  const remove = row.locator('a.inline-deletelink');
  if (await remove.count()) {
    await remove.first().click();
    await eventually(this, () => rowCount(inline), (n) => n === before - 1,
      (n) => ({ message: `After "Remove" the inline "${name}" still has ${n} rows.`, hint: 'The admin\'s inline script takes the new row away.' }), 3000);
    return;
  }
  const box = row.locator('input[type=checkbox][name$="-DELETE"]');
  if (!(await box.count())) {
    throw friendly({ message: `Row ${number} of the inline "${name}" can be neither removed nor deleted.`, hint: 'The inline does not let the account delete its rows (can_delete, or the delete permission).' });
  }
  await box.first().check();
});

/**
 * Assert whether a saved row of an inline is marked for deletion (its "Delete"
 * box ticked).
 *
 * Example #1: Then row 2 of the "Choices" inline should be marked for deletion
 * Example #2: Then row 1 of the "Choices" inline should not be marked for deletion
 * Example #3: And row 1 of the "Questions" inline should be marked for deletion
 * Example #4: Then row 3 of the "Choices" inline should not be marked for deletion
 * Example #5: And row 2 of the "Choices" inline should not be marked for deletion
 */
Then(/^row (\d+) of the "([^"]*)" inline should( not)* be marked for deletion$/, async function (number, name, notCase) {
  const inline = await inlineGroup(this, name);
  const row = await inlineRow(this, inline, parseInt(number, 10), name);
  const box = row.locator('input[type=checkbox][name$="-DELETE"]');
  const marked = (await box.count()) ? await box.first().isChecked() : false;
  if (marked === !!notCase) {
    throw friendly({ message: `Row ${number} of the inline "${name}" is ${marked ? '' : 'not '}marked for deletion.`, hint: `Mark it with: When I remove row ${number} of the "${name}" inline` });
  }
});

/**
 * Set a field of one row of an inline: by its column in a table, by its label
 * in a stacked row (see "I set "…" to "…"" for the values each kind takes).
 *
 * Example #1: When I set "Choice text" to "Yes" in row 1 of the "Choices" inline
 * Example #2: When I set "Votes" to "5" in row 1 of the "Choices" inline
 * Example #3: And we set "Choice text" to "No" in row 2 of the "Choices" inline
 * Example #4: When I set "Question text" to "Inline question" in row 1 of the "Questions" inline
 * Example #5: And I set "Date published" to "2026-01-15 10:30:00" in row 1 of the "Questions" inline
 */
When(/^(I |we )*set "([^"]*)" to "([^"]*)" in row (\d+) of the "([^"]*)" inline$/, async function (pronounCase, label, value, number, name) {
  const inline = await inlineGroup(this, name);
  const row = await inlineRow(this, inline, parseInt(number, 10), name);
  await setField(this, row, label, value, `Row ${number} of the inline "${name}"`);
});

/**
 * Fill the rows of an inline from a table: its first row names the columns
 * (the fields), each next row fills one inline row, from the first; the step
 * adds rows when the inline has too few.
 *
 * Example #1: When I fill in the "Choices" inline:
 * Example #2: And I fill in the "Choices" inline:
 * Example #3: When we fill in the "Questions" inline:
 * Example #4: And we fill in the "Choices" inline:
 * Example #5: Given I fill in the "Choices" inline:
 */
When(/^(I |we )*fill in the "([^"]*)" inline:$/, { timeout: 120000 }, async function (pronounCase, name, table) {
  const [labels, ...rows] = table.raw();
  const inline = await inlineGroup(this, name);
  for (let i = 0; i < rows.length; i += 1) {
    if ((await rowCount(inline)) < i + 1) {
      await inline.group.locator('.add-row a').first().click();
      await eventually(this, () => rowCount(inline), (n) => n >= i + 1,
        (n) => ({ message: `The inline "${name}" could not get a row ${i + 1} (it has ${n}).`, hint: 'The inline may be full (max_num).' }), 3000);
    }
    const row = await inlineRow(this, inline, i + 1, name);
    for (let c = 0; c < labels.length; c += 1) {
      if (rows[i][c] === undefined || rows[i][c] === '') continue;
      await setField(this, row, labels[c], rows[i][c], `Row ${i + 1} of the inline "${name}"`);
    }
  }
});

/**
 * Assert what a field of one row of an inline holds (see "… should be set to
 * …" for how each kind reads).
 *
 * Example #1: Then row 1 of the "Choices" inline should have "Yes" in "Choice text"
 * Example #2: Then row 1 of the "Choices" inline should have "5" in "Votes"
 * Example #3: And row 2 of the "Choices" inline should have "No" in "Choice text"
 * Example #4: Then row 1 of the "Questions" inline should have "Inline question" in "Question text"
 * Example #5: And row 2 of the "Choices" inline should have "0" in "Votes"
 */
Then(/^row (\d+) of the "([^"]*)" inline should have "([^"]*)" in "([^"]*)"$/, async function (number, name, expected, label) {
  const inline = await inlineGroup(this, name);
  const row = await inlineRow(this, inline, parseInt(number, 10), name);
  const value = await readField(this, row, label, `Row ${number} of the inline "${name}"`);
  if (normal(value) !== normal(expected)) {
    throw friendly({ message: `Row ${number} of the inline "${name}" has "${value}" in "${label}", not "${expected}".`, hint: 'A field of a table row is named by its column.' });
  }
});

/**
 * Assert that some row of an inline holds (or no row holds) a value, in any
 * of its fields.
 *
 * Example #1: Then the "Choices" inline should list "Yes"
 * Example #2: Then the "Choices" inline should not list "Maybe"
 * Example #3: And the "Questions" inline should list "Which instrument would you learn?"
 * Example #4: Then the "Choices" inline should list "No"
 * Example #5: And the "Choices" inline should not list "Yes"
 */
Then(/^the "([^"]*)" inline should( not)* list "([^"]*)"$/, async function (name, notCase, value) {
  const inline = await inlineGroup(this, name);
  const rows = inlineRows(inline);
  const count = await rows.count();
  const all = [];
  for (let i = 0; i < count; i += 1) all.push(...(await rowValues(rows.nth(i))));
  const has = all.some((v) => normal(v) === normal(value));
  if (has === !!notCase) {
    throw friendly({ message: notCase ? `The inline "${name}" lists "${value}".` : `The inline "${name}" does not list "${value}". Its rows hold: ${listed(all)}.`, hint: 'The step reads every field of every row.' });
  }
});

module.exports = { rowCount, clean };
