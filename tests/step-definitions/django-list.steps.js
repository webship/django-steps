'use strict';

// The change list: its rows and columns, the search, the filters of the
// sidebar (and their counts), the date drill-down, sorting by a column,
// pagination, the selection of rows (on a page, across all pages) and the
// actions run on them.

const { When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const {
  clean,
  normal,
  listed,
  escapeRegExp,
  hintFor,
  afterNavigation,
  pageSummary,
  eventually,
  changeListOrFail,
  listRows,
  listColumns,
  listCell,
  listCounts,
  listPages,
  filterBlock,
  filterTitles,
} = require('./django-helpers');

/** The object texts of the rows on screen. */
async function shownObjects(page) {
  return (await listRows(page)).map((r) => r.object);
}

/**
 * Search the change list with its search box (the model's search fields), as
 * a person does: type, then "Search".
 *
 * Example #1: When I search the list for "train"
 * Example #2: When we search the list for "Which"
 * Example #3: And I search the list for "editor"
 * Example #4: When I search the list for ""
 * Example #5: And we search the list for "no such question at all"
 */
When(/^(I |we )*search the list for "([^"]*)"$/, async function (pronounCase, text) {
  await changeListOrFail(this);
  const page = this.page;
  const box = page.locator('#searchbar');
  if (!(await box.count())) {
    throw friendly({ message: 'The list has no search box.', hint: 'The admin draws the search box when the model\'s admin has search_fields.' });
  }
  await box.fill(text || '');
  await afterNavigation(this, () => page.locator('#changelist-search [type="submit"]').first().click());
});

/**
 * Assert what the last search found: the count the list writes beside the
 * search box ("2 results (24 total)"), with the total when the step gives it.
 *
 * Example #1: Then the search should find 2 results
 * Example #2: Then the search should find 2 results of 24
 * Example #3: And the search should find 1 result
 * Example #4: Then the search should find 0 results of 24
 * Example #5: And the search should find 12 results
 */
Then(/^the search should find (\d+) results?(?: of (\d+))?$/, async function (found, total) {
  await changeListOrFail(this);
  const counts = await listCounts(this.page);
  if (counts.results !== parseInt(found, 10) || (total && counts.total !== parseInt(total, 10))) {
    throw friendly({
      message: counts.results === null
        ? `The list shows no search count: ${await pageSummary(this)}.`
        : `The search found ${counts.results} result${counts.results === 1 ? '' : 's'} of ${counts.total} ("${counts.searchText}"), not ${found}${total ? ` of ${total}` : ''}.`,
      hint: 'Search first: When I search the list for "train"',
    });
  }
});

/**
 * Assert that the change list shows (or does not show) a row, by the object's
 * text in its first column (the link to its page).
 *
 * Example #1: Then the list should show "Which river is the longest?"
 * Example #2: Then the list should not show "What's up?"
 * Example #3: And the list should show "editor"
 * Example #4: Then the list should show "Do you travel by train or by plane?"
 * Example #5: And the list should not show "Which train journey is the most beautiful?"
 */
Then(/^the list should( not)* show "([^"]*)"$/, async function (notCase, object) {
  await changeListOrFail(this);
  const shown = await shownObjects(this.page);
  const has = shown.some((o) => normal(o) === normal(object));
  if (has === !!notCase) {
    throw friendly({
      message: notCase ? `The list shows "${object}".` : `The list does not show "${object}" on this page. It shows: ${listed(shown)}.`,
      hint: 'A row is named by the text of its first column. The list shows one page at a time: search for the row, or go to its page.',
    });
  }
});

/**
 * Assert how many rows the change list shows on its current page.
 *
 * Example #1: Then the list should have 10 rows
 * Example #2: Then the list should have 2 rows
 * Example #3: And the list should have 1 row
 * Example #4: Then the list should have 4 rows
 * Example #5: And the list should have 0 rows
 */
Then(/^the list should have (\d+) rows?$/, async function (expected) {
  await changeListOrFail(this);
  const shown = await shownObjects(this.page);
  if (shown.length !== parseInt(expected, 10)) {
    throw friendly({ message: `The list has ${shown.length} row${shown.length === 1 ? '' : 's'} on this page, not ${expected}: ${listed(shown)}.`, hint: 'The list shows a page of rows at a time (list_per_page).' });
  }
});

/**
 * Assert the count the change list gives below its rows for all its pages
 * ("24 questions"): the number, and the name the list counts in.
 *
 * Example #1: Then the list should count 24 questions
 * Example #2: Then the list should count 1 question
 * Example #3: And the list should count 3 users
 * Example #4: Then the list should count 12 questions
 * Example #5: And the list should count 0 questions
 */
Then(/^the list should count (\d+) ([^"]+)$/, async function (expected, noun) {
  await changeListOrFail(this);
  const counts = await listCounts(this.page);
  const said = normal(counts.paginator);
  if (counts.count !== parseInt(expected, 10) || !said.includes(normal(`${expected} ${noun}`))) {
    throw friendly({ message: `The list counts "${counts.paginator || '(nothing)'}", not "${expected} ${noun}".`, hint: 'The count is the line below the rows: the number and the model\'s name.' });
  }
});

/**
 * Assert the headings of the change list's columns, in order (the column of
 * the selection boxes left out).
 *
 * Example #1: Then the list columns should be "Question text", "Date published", "Category", "Published recently?"
 * Example #2: Then the list columns should be "Username", "Email address", "First name", "Last name", "Staff status"
 * Example #3: And the list columns should be "Name"
 * Example #4: Then the list columns should be "Category"
 * Example #5: And the list columns should be "Tag"
 */
Then(/^the list columns should be ("[^"]*"(?:,\s*"[^"]*")*)$/, async function (spec) {
  await changeListOrFail(this);
  const want = [...spec.matchAll(/"([^"]*)"/g)].map((m) => m[1]);
  const columns = await listColumns(this.page);
  if (columns.length !== want.length || !columns.every((c, i) => normal(c) === normal(want[i]))) {
    throw friendly({ message: `The list columns are ${listed(columns)}, not ${listed(want)}.`, hint: 'The columns are the model admin\'s list_display, in its order.' });
  }
});

/**
 * Assert the text of one cell of the change list: the row of an object, the
 * column of a heading. A yes/no column shows an icon: write "yes" or "no".
 *
 * Example #1: Then the "Which river is the longest?" row should show "Science" in the "Category" column
 * Example #2: Then the "editor" row should show "editor@example.com" in the "Email address" column
 * Example #3: And the "viewer" row should show "yes" in the "Staff status" column
 * Example #4: Then the "What's up?" row should show "no" in the "Published recently?" column
 * Example #5: And the "What's up?" row should show "Jan. 6, 2025, 9 a.m." in the "Date published" column
 */
Then(/^the "([^"]*)" row should show "([^"]*)" in the "([^"]*)" column$/, async function (object, expected, column) {
  await changeListOrFail(this);
  const cell = await listCell(this.page, object, column);
  if (cell.error === 'column') {
    throw friendly({ message: `The list has no column "${column}". Its columns: ${listed(cell.columns)}.`, hint: 'Name the column by its heading.' });
  }
  if (cell.error === 'row') {
    throw friendly({ message: `The list has no row "${object}" on this page. It shows: ${listed(cell.rows)}.`, hint: 'Search for the row, or go to its page, first.' });
  }
  const yesNo = { yes: 'true', no: 'false', true: 'true', false: 'false' };
  const got = normal(cell.text);
  const want = normal(expected);
  const same = got === want || (yesNo[want] && got === yesNo[want]);
  if (!same) {
    throw friendly({ message: `The "${object}" row shows "${cell.text}" in the "${column}" column, not "${expected}".`, hint: 'A yes/no column shows an icon: write "yes" or "no" for it.' });
  }
});

/**
 * Assert which row comes first, or last, on the current page of the list.
 *
 * Example #1: Then the first row of the list should be "What's up?"
 * Example #2: Then the last row of the list should be "Which breakfast keeps you going?"
 * Example #3: And the first row of the list should be "administrator"
 * Example #4: Then the first row of the list should be "Which breakfast keeps you going?"
 * Example #5: And the last row of the list should be "viewer"
 */
Then(/^the (first|last) row of the list should be "([^"]*)"$/, async function (which, object) {
  await changeListOrFail(this);
  const shown = await shownObjects(this.page);
  const row = which === 'first' ? shown[0] : shown[shown.length - 1];
  if (normal(row || '') !== normal(object)) {
    throw friendly({ message: `The ${which} row of the list is "${row || '(no row)'}", not "${object}". The rows: ${listed(shown)}.`, hint: 'The order follows the sorting of the list.' });
  }
});

/**
 * Assert that one row comes before another on the current page of the list.
 *
 * Example #1: Then "What's up?" should come before "Which fruit do you eat most?" in the list
 * Example #2: Then "administrator" should come before "viewer" in the list
 * Example #3: And "Which river is the longest?" should come before "Which season do you like best?" in the list
 * Example #4: Then "Which breakfast keeps you going?" should come before "What's up?" in the list
 * Example #5: And "editor" should come before "viewer" in the list
 */
Then(/^"([^"]*)" should come before "([^"]*)" in the list$/, async function (first, second) {
  await changeListOrFail(this);
  const shown = await shownObjects(this.page);
  const a = shown.findIndex((o) => normal(o) === normal(first));
  const b = shown.findIndex((o) => normal(o) === normal(second));
  if (a < 0 || b < 0 || a >= b) {
    throw friendly({
      message: a < 0 || b < 0
        ? `The list does not show ${a < 0 ? `"${first}"` : `"${second}"`} on this page. It shows: ${listed(shown)}.`
        : `"${first}" comes after "${second}" in the list: ${listed(shown)}.`,
      hint: 'Both rows must be on the page the list shows.',
    });
  }
});

/** The heading cell of a sortable column, by its text. */
function columnHeading(page, column) {
  return page.locator('#result_list thead th').filter({ hasText: new RegExp('^\\s*' + escapeRegExp(clean(column)) + '\\s*$', 'i') });
}

/** The order a column sorts the list in: 'ascending', 'descending' or '' (not sorted by it). */
async function sortOrder(page, column) {
  const th = columnHeading(page, column);
  if (!(await th.count())) return null;
  const cls = (await th.first().getAttribute('class')) || '';
  if (!/\bsorted\b/.test(cls)) return '';
  return /\bdescending\b/.test(cls) ? 'descending' : 'ascending';
}

/**
 * Sort the change list by a column, with the column's heading as a person
 * does: a first click sorts ascending, a second descending.
 *
 * Example #1: When I sort the list by "Date published"
 * Example #2: When I sort the list by "Date published" in descending order
 * Example #3: And we sort the list by "Question text" in ascending order
 * Example #4: When I sort the list by "Username"
 * Example #5: And I sort the list by "Category" in descending order
 */
When(/^(I |we )*sort the list by "([^"]*)"(?: in (ascending|descending) order)?$/, async function (pronounCase, column, order) {
  await changeListOrFail(this);
  const page = this.page;
  const want = order || 'ascending';
  for (let i = 0; i < 3; i += 1) {
    const now = await sortOrder(page, column);
    if (now === null) {
      throw friendly({ message: `The list has no column "${column}". Its columns: ${listed(await listColumns(page))}.`, hint: 'Name the column by its heading.' });
    }
    if (now === want) return;
    const link = columnHeading(page, column).first().locator('.text a');
    if (!(await link.count())) {
      throw friendly({ message: `The column "${column}" cannot be sorted: its heading is no link.`, hint: 'A column sorts when its field (or its admin_order_field) can be ordered.' });
    }
    await afterNavigation(this, () => link.first().click());
  }
  throw friendly({ message: `The list did not sort by "${column}" in ${want} order: it is "${await sortOrder(page, column)}".`, hint: 'The heading of a sorted column carries the admin\'s sorted state.' });
});

/**
 * Assert the order the change list is sorted in by a column, as the column's
 * heading shows it.
 *
 * Example #1: Then the list should be sorted by "Date published" in ascending order
 * Example #2: Then the list should be sorted by "Date published" in descending order
 * Example #3: And the list should be sorted by "Question text" in ascending order
 * Example #4: Then the list should be sorted by "Username" in descending order
 * Example #5: And the list should be sorted by "Category" in ascending order
 */
Then(/^the list should be sorted by "([^"]*)" in (ascending|descending) order$/, async function (column, order) {
  await changeListOrFail(this);
  const now = await sortOrder(this.page, column);
  if (now !== order) {
    throw friendly({
      message: now === null ? `The list has no column "${column}". Its columns: ${listed(await listColumns(this.page))}.` : `The list is ${now ? `sorted by "${column}" in ${now} order` : `not sorted by "${column}"`}, not in ${order} order.`,
      hint: `Sort it with: When I sort the list by "${column}" in ${order} order`,
    });
  }
});

/**
 * Choose a value in a filter of the list's sidebar ("By category"), by the
 * value's text as the filter shows it ("Science", "Any date", "All").
 *
 * Example #1: When I choose "Science" in the "By category" filter
 * Example #2: When I choose "All" in the "By category" filter
 * Example #3: And we choose "Yes" in the "By staff status" filter
 * Example #4: When I choose "Editors" in the "By groups" filter
 * Example #5: And I choose "Any date" in the "By date published" filter
 */
When(/^(I |we )*choose "([^"]*)" in the "([^"]*)" filter$/, async function (pronounCase, value, title) {
  await changeListOrFail(this);
  const page = this.page;
  const block = filterBlock(page, title);
  if (!(await block.count())) {
    throw friendly({ message: `The list has no filter "${title}". Its filters: ${listed(await filterTitles(page))}.`, hint: 'Name a filter as the sidebar shows it, such as "By category".' });
  }
  const link = block.first().locator('li a').filter({ hasText: new RegExp('^\\s*' + escapeRegExp(clean(value)) + '(\\s*\\(\\d+\\))?\\s*$') });
  if (!(await link.count())) {
    const offered = await block.first().locator('li a').allTextContents();
    throw friendly({ message: `The "${title}" filter offers no "${value}". It offers: ${listed(offered)}.`, hint: 'Write the value as the filter shows it.' });
  }
  if (!(await block.first().evaluate((d) => d.tagName !== 'DETAILS' || d.open))) await block.first().locator('summary').click();
  await afterNavigation(this, () => link.first().click());
});

/**
 * Assert the value a filter of the sidebar is set to (the one it marks as
 * chosen).
 *
 * Example #1: Then the "By category" filter should be set to "Science"
 * Example #2: Then the "By category" filter should be set to "All"
 * Example #3: And the "By staff status" filter should be set to "Yes"
 * Example #4: Then the "By date published" filter should be set to "Any date"
 * Example #5: And the "By groups" filter should be set to "Editors"
 */
Then(/^the "([^"]*)" filter should be set to "([^"]*)"$/, async function (title, value) {
  await changeListOrFail(this);
  const page = this.page;
  const block = filterBlock(page, title);
  if (!(await block.count())) {
    throw friendly({ message: `The list has no filter "${title}". Its filters: ${listed(await filterTitles(page))}.`, hint: 'Name a filter as the sidebar shows it, such as "By category".' });
  }
  const chosen = clean(await block.first().locator('li.selected').first().innerText().catch(() => '')).replace(/\s*\(\d+\)$/, '');
  if (normal(chosen) !== normal(value)) {
    throw friendly({ message: `The "${title}" filter is set to "${chosen || '(nothing)'}", not "${value}".`, hint: `Choose it with: When I choose "${value}" in the "${title}" filter` });
  }
});

/**
 * Clear every filter of the list with the sidebar's "Clear all filters" link
 * (the list then shows all its rows again).
 *
 * Example #1: When I clear all filters
 * Example #2: When we clear all filters
 * Example #3: And I clear all filters
 * Example #4: When I clear all the filters
 * Example #5: And we clear all the filters
 */
When(/^(I |we )*clear all (?:the )?filters$/, async function (pronounCase) {
  await changeListOrFail(this);
  const page = this.page;
  const link = page.locator('#changelist-filter a').filter({ hasText: /Clear all filters/i });
  if (!(await link.count())) {
    throw friendly({ message: 'The filter sidebar has no "Clear all filters" link: no filter is set.', hint: 'The link shows once a filter is chosen.' });
  }
  await afterNavigation(this, () => link.first().click());
});

/**
 * Show the counts of the filters' values ("Show counts" in the sidebar): each
 * value then says how many rows it keeps, "Science (5)".
 *
 * Example #1: When I show the filter counts
 * Example #2: When we show the filter counts
 * Example #3: And I show the filter counts
 * Example #4: Then I show the filter counts
 * Example #5: Given I show the filter counts
 */
When(/^(I |we )*show the filter counts$/, async function (pronounCase) {
  await changeListOrFail(this);
  const page = this.page;
  const link = page.locator('#changelist-filter-extra-actions a, #changelist-filter a').filter({ hasText: /^\s*Show counts\s*$/i });
  if (!(await link.count())) {
    if (await page.locator('#changelist-filter a').filter({ hasText: /^\s*Hide counts\s*$/i }).count()) return;
    throw friendly({ message: 'The filter sidebar has no "Show counts" link.', hint: 'The admin offers the counts when the model admin keeps show_facets on its default.' });
  }
  await afterNavigation(this, () => link.first().click());
});

/**
 * Assert the count a filter's value shows once the counts are on (see "I show
 * the filter counts"): "Science (5)".
 *
 * Example #1: Then the "By category" filter should count 5 for "Science"
 * Example #2: Then the "By category" filter should count 4 for "Travel"
 * Example #3: And the "By category" filter should count 2 for "-"
 * Example #4: Then the "By staff status" filter should count 3 for "Yes"
 * Example #5: And the "By groups" filter should count 1 for "Viewers"
 */
Then(/^the "([^"]*)" filter should count (\d+) for "([^"]*)"$/, async function (title, expected, value) {
  await changeListOrFail(this);
  const page = this.page;
  const block = filterBlock(page, title);
  if (!(await block.count())) {
    throw friendly({ message: `The list has no filter "${title}". Its filters: ${listed(await filterTitles(page))}.`, hint: 'Name a filter as the sidebar shows it.' });
  }
  const values = (await block.first().locator('li a').allTextContents()).map(clean);
  const entry = values.find((v) => normal(v.replace(/\s*\(\d+\)$/, '')) === normal(value));
  const count = entry && entry.match(/\((\d+)\)$/);
  if (!count || count[1] !== String(expected)) {
    throw friendly({
      message: !entry ? `The "${title}" filter offers no "${value}". It offers: ${listed(values)}.` : (count ? `The "${title}" filter counts ${count[1]} for "${value}", not ${expected}.` : `The "${title}" filter shows no counts ("${entry}").`),
      hint: 'Show the counts first: When I show the filter counts',
    });
  }
});

/**
 * Choose a date in the list's date drill-down above the rows: a year, then a
 * month ("January 2025"), then a day; "All dates" goes back to every date.
 *
 * Example #1: When I choose "2025" in the date drill-down
 * Example #2: When I choose "January 2025" in the date drill-down
 * Example #3: And we choose "All dates" in the date drill-down
 * Example #4: When I choose "2026" in the date drill-down
 * Example #5: And I choose "June 2026" in the date drill-down
 */
When(/^(I |we )*choose "([^"]*)" in the date drill-down$/, async function (pronounCase, value) {
  await changeListOrFail(this);
  const page = this.page;
  const links = page.locator('nav.toplinks a, .xfull a');
  if (!(await links.count())) {
    throw friendly({ message: 'The list has no date drill-down.', hint: 'The admin draws it when the model admin has date_hierarchy.' });
  }
  const link = links.filter({ hasText: new RegExp('^\\s*(‹\\s*)?' + escapeRegExp(clean(value)) + '\\s*$', 'i') });
  if (!(await link.count())) {
    throw friendly({ message: `The date drill-down offers no "${value}". It offers: ${listed(await links.allTextContents())}.`, hint: 'The drill-down offers the dates one level down (the years, the months of a year, the days of a month), and the level up as "‹ …": "‹ All dates" from a year, "‹ 2025" from a month.' });
  }
  await afterNavigation(this, () => link.first().click());
});

/**
 * Assert that the date drill-down offers (or does not offer) a date.
 *
 * Example #1: Then the date drill-down should offer "2025"
 * Example #2: Then the date drill-down should offer "January 2025"
 * Example #3: And the date drill-down should not offer "2024"
 * Example #4: Then the date drill-down should offer "All dates"
 * Example #5: And the date drill-down should not offer "July 2026"
 */
Then(/^the date drill-down should( not)* offer "([^"]*)"$/, async function (notCase, value) {
  await changeListOrFail(this);
  const offered = (await this.page.locator('nav.toplinks a, .xfull a').allTextContents().catch(() => [])).map((t) => clean(t).replace(/^‹\s*/, ''));
  const has = offered.some((t) => normal(t) === normal(value));
  if (has === !!notCase) {
    throw friendly({ message: notCase ? `The date drill-down offers "${value}".` : `The date drill-down does not offer "${value}". It offers: ${listed(offered)}.`, hint: 'It offers the years, months or days that have rows, one level at a time.' });
  }
});

/**
 * Go to a page of the list with its paginator.
 *
 * Example #1: When I go to page 2 of the list
 * Example #2: When we go to page 3 of the list
 * Example #3: And I go to page 1 of the list
 * Example #4: When I go to page 2 of the list
 * Example #5: And we go to page 1 of the list
 */
When(/^(I |we )*go to page (\d+) of the list$/, async function (pronounCase, number) {
  await changeListOrFail(this);
  const page = this.page;
  const pages = await listPages(page);
  if (pages.current === parseInt(number, 10)) return;
  const link = page.locator('.paginator a').filter({ hasText: new RegExp(`^\\s*${number}\\s*$`) });
  if (!(await link.count())) {
    throw friendly({ message: `The list has no page ${number}: it has ${pages.last} page${pages.last === 1 ? '' : 's'}.`, hint: 'The paginator links the pages near the current one.' });
  }
  await afterNavigation(this, () => link.first().click());
});

/**
 * Assert the page of the list on screen.
 *
 * Example #1: Then the list should be on page 2
 * Example #2: Then the list should be on page 1
 * Example #3: And the list should be on page 3
 * Example #4: Then the list should be on page 1
 * Example #5: And the list should be on page 2
 */
Then(/^the list should be on page (\d+)$/, async function (number) {
  await changeListOrFail(this);
  const pages = await listPages(this.page);
  if (pages.current !== parseInt(number, 10)) {
    throw friendly({ message: `The list is on page ${pages.current} of ${pages.last}, not page ${number}.`, hint: `Go there with: When I go to page ${number} of the list` });
  }
});

/**
 * Assert how many pages the list has.
 *
 * Example #1: Then the list should have 3 pages
 * Example #2: Then the list should have 1 page
 * Example #3: And the list should have 2 pages
 * Example #4: Then the list should have 3 pages
 * Example #5: And the list should have 1 page
 */
Then(/^the list should have (\d+) pages?$/, async function (number) {
  await changeListOrFail(this);
  const pages = await listPages(this.page);
  if (pages.last !== parseInt(number, 10)) {
    throw friendly({ message: `The list has ${pages.last} page${pages.last === 1 ? '' : 's'}, not ${number}.`, hint: 'The list shows list_per_page rows a page (100 by default).' });
  }
});

/**
 * Show every row of the list on one page, with the paginator's "Show all"
 * link (offered while the list is short enough: list_max_show_all).
 *
 * Example #1: When I show all rows of the list
 * Example #2: When we show all rows of the list
 * Example #3: And I show all rows of the list
 * Example #4: When I show all the rows of the list
 * Example #5: And we show all the rows of the list
 */
When(/^(I |we )*show all (?:the )?rows of the list$/, async function (pronounCase) {
  await changeListOrFail(this);
  const page = this.page;
  const link = page.locator('.paginator a.showall');
  if (!(await link.count())) {
    throw friendly({ message: 'The paginator has no "Show all" link.', hint: 'The admin offers it when the list has more than one page and no more rows than list_max_show_all.' });
  }
  await afterNavigation(this, () => link.first().click());
});

/** The selection box of a row, by the object's text. */
function rowBox(page, object) {
  return page.locator('#result_list tbody tr').filter({
    has: page.locator('th, td').filter({ hasText: new RegExp('^\\s*' + escapeRegExp(clean(object)) + '\\s*$') }),
  }).locator('input.action-select');
}

/**
 * Tick (or clear) the selection box of a row of the list, by the object's
 * text, for an action.
 *
 * Example #1: When I select "Which river is the longest?" in the list
 * Example #2: When I unselect "Which river is the longest?" in the list
 * Example #3: And we select "Action test question one" in the list
 * Example #4: When I select "What's up?" in the list
 * Example #5: And I unselect "What's up?" in the list
 */
When(/^(I |we )*(select|unselect) "([^"]*)" in the list$/, async function (pronounCase, verb, object) {
  await changeListOrFail(this);
  const box = rowBox(this.page, object);
  if (!(await box.count())) {
    const shown = await shownObjects(this.page);
    throw friendly({
      message: (await this.page.locator('input.action-select').count())
        ? `The list has no row "${object}" on this page. It shows: ${listed(shown)}.`
        : 'The list has no selection boxes: the account may run no action on it.',
      hint: 'Search for the row, or go to its page, first.',
    });
  }
  if (verb === 'select') await box.first().check();
  else await box.first().uncheck();
});

/**
 * Tick the box above the list that selects every row of the page.
 *
 * Example #1: When I select all rows on the page
 * Example #2: When we select all rows on the page
 * Example #3: And I select all the rows on the page
 * Example #4: When I select all rows on the page
 * Example #5: And we select all the rows on the page
 */
When(/^(I |we )*select all (?:the )?rows on the page$/, async function (pronounCase) {
  await changeListOrFail(this);
  const toggle = this.page.locator('#action-toggle');
  if (!(await toggle.count())) {
    throw friendly({ message: 'The list has no box to select its rows: the account may run no action on it.', hint: 'The admin draws the selection boxes when the account may run an action.' });
  }
  await toggle.check();
});

/**
 * Select every row of the list, on all its pages: the rows of the page, then
 * the link "Select all 24 questions" the admin offers then.
 *
 * Example #1: When I select everything in the list
 * Example #2: When we select everything in the list
 * Example #3: And I select everything in the list
 * Example #4: Then I select everything in the list
 * Example #5: Given we select everything in the list
 */
When(/^(I |we )*select everything in the list$/, async function (pronounCase) {
  await changeListOrFail(this);
  const page = this.page;
  const toggle = page.locator('#action-toggle');
  if (!(await toggle.count())) {
    throw friendly({ message: 'The list has no box to select its rows: the account may run no action on it.', hint: 'The admin draws the selection boxes when the account may run an action.' });
  }
  await toggle.check();
  const across = page.locator('.actions .question a');
  if (await across.isVisible().catch(() => false)) {
    await across.click();
    await page.locator('.actions .all').waitFor({ state: 'visible', timeout: 5000 });
  }
});

/**
 * Clear the selection of the list with the admin's "Clear selection" link
 * (after selecting across pages), or by clearing every box.
 *
 * Example #1: When I clear the selection
 * Example #2: When we clear the selection
 * Example #3: And I clear the selection
 * Example #4: Then I clear the selection
 * Example #5: Given we clear the selection
 */
When(/^(I |we )*clear the selection$/, async function (pronounCase) {
  await changeListOrFail(this);
  const page = this.page;
  const clear = page.locator('.actions .clear a');
  if (await clear.isVisible().catch(() => false)) {
    await clear.click();
  } else if (await page.locator('#action-toggle').count()) {
    await page.locator('#action-toggle').check();
    await page.locator('#action-toggle').uncheck();
  }
});

/**
 * Assert what the action bar says about the selection: "2 of 10 selected", or
 * "All 24 selected" after selecting across all pages.
 *
 * Example #1: Then the selection should read "2 of 10 selected"
 * Example #2: Then the selection should read "All 24 selected"
 * Example #3: And the selection should read "0 of 10 selected"
 * Example #4: Then the selection should read "10 of 10 selected"
 * Example #5: And the selection should read "1 of 3 selected"
 */
Then(/^the selection should read "([^"]*)"$/, async function (expected) {
  await changeListOrFail(this);
  const page = this.page;
  const read = () => page.evaluate(() => [...document.querySelectorAll('.actions .action-counter, .actions .all')]
    .filter((e) => !e.classList.contains('hidden') && getComputedStyle(e).display !== 'none')
    .map((e) => e.textContent.replace(/\s+/g, ' ').trim()).join(' ')).catch(() => '');
  await eventually(this, read, (text) => normal(text) === normal(expected),
    (text) => ({ message: `The action bar says "${text || '(nothing)'}", not "${expected}".`, hint: 'The counter follows the boxes of the rows; select across pages with: When I select everything in the list' }), 3000);
});

/**
 * Assert that the action list of the change list offers (or does not offer)
 * an action, by its text ("Delete selected questions").
 *
 * Example #1: Then the list should offer the action "Delete selected questions"
 * Example #2: Then the list should offer the action "Reset the votes of the selected questions"
 * Example #3: And the list should not offer the action "Delete selected questions"
 * Example #4: Then the list should not offer the action "Reset the votes of the selected questions"
 * Example #5: And the list should offer the action "Delete selected users"
 */
Then(/^the list should( not)* offer the action "([^"]*)"$/, async function (notCase, action) {
  await changeListOrFail(this);
  const options = (await this.page.locator('.actions select[name="action"] option').allTextContents().catch(() => [])).map(clean).filter((o) => !/^-+$|^- .* -$/.test(o));
  const has = options.some((o) => normal(o) === normal(action));
  if (has === !!notCase) {
    throw friendly({ message: notCase ? `The list offers the action "${action}".` : `The list does not offer the action "${action}". It offers: ${listed(options)}.`, hint: 'An account sees only the actions its permissions allow.' });
  }
});

/**
 * Run an action on the rows that are selected: choose it in the action list
 * and press the button beside it ("Run", "Go" on older releases). An action
 * that asks first (such as "Delete selected …") opens its confirmation.
 *
 * Example #1: When I run the action "Delete selected questions"
 * Example #2: When I run the action "Reset the votes of the selected questions"
 * Example #3: And we run the action "Delete selected questions"
 * Example #4: When we run the action "Reset the votes of the selected questions"
 * Example #5: And I run the action "Delete selected tags"
 */
When(/^(I |we )*run the action "([^"]*)"$/, async function (pronounCase, action) {
  await changeListOrFail(this);
  const page = this.page;
  const select = page.locator('.actions select[name="action"]');
  if (!(await select.count())) {
    throw friendly({ message: 'The list has no actions: the account may run none on it.', hint: 'The admin draws the action bar when the account may run an action.' });
  }
  const options = (await select.locator('option').allTextContents()).map(clean);
  const exact = options.find((o) => normal(o) === normal(action));
  if (!exact) {
    throw friendly({ message: `The list offers no action "${action}". It offers: ${listed(options.filter((o) => !/^-+$|^- .* -$/.test(o)))}.`, hint: 'Write the action as the list shows it.' });
  }
  await select.selectOption({ label: exact });
  await afterNavigation(this, () => page.locator('.actions button[name="index"], .actions [type="submit"]').first().click());
});

module.exports = { shownObjects, rowBox };
