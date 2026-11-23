<p align="center"><img src="https://raw.githubusercontent.com/webship/django-steps/2.0.x/assets/logo.svg" alt="Django logo" width="96"></p>

# django-steps

[![Test](https://github.com/webship/django-steps/actions/workflows/test.yml/badge.svg)](https://github.com/webship/django-steps/actions/workflows/test.yml)

Cucumber step definitions for testing the Django admin, with
[webship-js](https://webship.co/docs/webship-js/2.0.x), a BDD browser automation
harness built on Playwright and Cucumber-js.

`@webship-js/django-steps` covers what the admin of every Django project shows,
whatever its models:

- **the session**: the admin login by a handle of the users registry or through
  the form, its refusal, logging out, who is signed in;
- **the index**: its apps and models, what an account may do with each (add,
  change, view), the recent actions, the breadcrumbs, the navigation sidebar and
  its filter, the colour theme;
- **the change list**: its columns and cells, the search and its count, the
  filters of the sidebar and their counts, sorting by a column, the date
  drill-down, the pages and "Show all", selecting rows (on a page, across all
  pages), running an action, and the "Delete selected" confirmation;
- **the add and change forms**: every kind of field by its label (a text, a
  list, a box, a date and time with the "Today" and "Now" shortcuts, an
  autocomplete field, a two-list selector), read-only fields, the sections and
  the ones that fold, the inline rows (in a table or stacked: add, remove, fill,
  read), the three save buttons, the messages after saving, the errors of a
  refused form, and the view-only form;
- **deleting**: the delete confirmation with the related objects it takes,
  confirming or going back, the refusal when a protected relation keeps the
  object, and **the history** of an object's changes;
- **the password change** and its refusals;
- **users and groups**: an account's status and groups, a group's permissions,
  and the pages an account is refused;
- **test objects**: a scenario makes the objects it needs through the admin's own
  forms and the steps delete them after it, whatever happens in it.

No step phrase names the platform: a scenario reads `When I choose "Science" in
the "Category" autocomplete` and `Then the delete confirmation should list
"Choice: Yes"`.

CI builds a real site with [DDEV](https://ddev.com) on the runner (a plain
project made with `django-admin startproject`, the polls app of the official
tutorial, PostgreSQL 16), at the current release line, Django 6.1, and the
long-term-support line, Django 5.2, and runs the whole suite against it twice on
every push and pull request, then the assertions that must fail; see
[`.github/workflows/test.yml`](.github/workflows/test.yml).

## From nothing to a green run

What the machine needs: Docker, [DDEV](https://ddev.com), git, python3, and
Node.js 24 or later with npm. Python, Django, PostgreSQL and the site's server
run in DDEV's containers.

**1. The site.** The pack's own build script (the one CI runs) makes the site in
a generic DDEV project (DDEV has no project type for Django): Python 3.13 in the
web image, a project made with `django-admin startproject mysite`, the polls app
of the official tutorial registered in the admin, its sample data, PostgreSQL 16,
the site served by the web container, and the three accounts of
[Test users](#test-users). It takes about two minutes the first time
(`DJANGO_VERSION=5.2` builds the long-term-support line).

```bash
git clone https://github.com/webship/django-steps.git
SITE_DIR="$PWD/django-site" django-steps/.github/scripts/build-ddev-site.sh
```

The site answers at `https://djangosteps.ddev.site`, its admin at `/admin/`.
Its accounts are `administrator`, `editor` and `viewer`, each with the password
`dD.123123ddd` (step 3 names them).

In the [Webship Workspace](https://github.com/webship/workspace), its Django
plugin builds the same site instead, in a sites folder of the workspace (`dev/`
here, the one `--with-needs` adds to a new workspace; `test/`, `sandboxes/` and
`demos/` work the same):

```bash
bash core/scripts/plugins.sh --require django --with-needs
bash core/scripts/plugins.sh --activate django --with-needs
bash core/scripts/plugins.sh --install django
bash dev/cmd-django-project.sh djsite --install --add-users --polls
```

That site answers at `https://djsite.ddev.site`. `--polls` adds the polls app
and its sample data (the features of this pack need them). Its accounts are the
plugin's, the same three with the workspace's shared password `dD.123123ddd`:
`administrator`, `editor` and `viewer`. The workspace's own account is a
superuser too; the suite does not use it.

**2. A test project.**

```bash
mkdir django-tests && cd django-tests
npm init -y
npm install --save-dev webship-js @webship-js/django-steps
npx init-webship-js
rm tests/features/check-homepage.feature
```

`npx init-webship-js` writes `cucumber.js`, `playwright.config.ts`, the `tests/`
folders with a first feature and the `npm test` scripts, and installs Chromium.
npm usually runs it already when it installs webship-js; a second run changes
nothing. Its first feature opens the site's home page, which a plain project does
not have (the browser logs its 404): the last line removes it.

**3. `cucumber.js`.** Replace the file with the wiring of the pack: the step
files of webship-js and of the pack, the tags that keep the assertions that must
fail out of a normal run, the address of the site, the browser messages that are
no error of the site, and the accounts (the JSON of [Test users](#test-users)).
The first lines are the starter's own: a feature named on the command line runs
alone (step 5).

```javascript
// A feature file or a scenario (file:line) named on the command line runs alone:
// cucumber-js 12 would add it to the paths below, so `paths` is left empty then.
const OPTIONS_WITH_A_VALUE = new Set([
  '-c', '--config', '-f', '--format', '--format-options', '--i18n-keywords',
  '-i', '--import', '-l', '--loader', '--language', '--name', '--order',
  '-p', '--profile', '--parallel', '--plugin', '--plugin-options',
  '-r', '--require', '--require-module', '--retry', '--retry-tag-filter',
  '--shard', '-t', '--tags', '--world-parameters',
]);

function commandLinePaths() {
  if (!/cucumber(-js|\.js)?$/.test(String(process.argv[1] || ''))) return [];
  const args = process.argv.slice(2);
  const paths = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i].startsWith('-')) {
      if (OPTIONS_WITH_A_VALUE.has(args[i])) i += 1;
    } else {
      paths.push(args[i]);
    }
  }
  return paths;
}

module.exports = {
  default: {
    requireModule: ['tsx/cjs'],
    require: [
      'node_modules/webship-js/tests/step-definitions/**/*.js',
      'node_modules/@webship-js/django-steps/tests/step-definitions/**/*.js',
      'tests/step-definitions/**/*.js',
    ],
    paths: commandLinePaths().length ? [] : ['tests/features/**/*.feature'],
    // Work in progress and the assertions that must fail stay out of a normal run.
    tags: 'not @wip and not @must-fail',
    format: ['@cucumber/pretty-formatter', 'json:tests/reports/cucumber_report.json'],
    worldParameters: {
      launchUrl: process.env.LAUNCH_URL || 'https://djangosteps.ddev.site',
      // Where the admin is on the site, and the account the test-object steps work as (a superuser of `users`).
      adminPath: '/admin/',
      dataAdmin: 'administrator',
      // No error of the site: the 5.2 admin's unload listener, and a request lost when the machine's network changed.
      javascript: { mode: 'warn', levels: ['error'], ignore: 'Permissions policy violation: unload is not allowed|net::ERR_NETWORK_CHANGED', beforeScenario: false, afterScenario: true },
      minWaitTime: { page: 3000, before_scenario: 0, after_scenario: 0, before_step: 0, after_step: 0 },
      users: {
        administrator: { username: 'administrator', password: 'dD.123123ddd', email: 'administrator@example.com' },
        editor: { username: 'editor', password: 'dD.123123ddd', email: 'editor@example.com' },
        viewer: { username: 'viewer', password: 'dD.123123ddd', email: 'viewer@example.com' },
      },
    },
  },
};
```

On a site from the Webship Workspace (step 1) the accounts are the same; its
address goes in `LAUNCH_URL` (step 5).

**4. A first feature**, `tests/features/first-run.feature`:

```gherkin
Feature: First run
  Scenario: The editor logs in to the admin
    Given I am not logged in
    When I log in as "editor" with the login form
    Then I should be logged in as "editor"

  Scenario: The editor finds questions in the list
    Given I am a logged in user with the "editor" user
    And I am on the "Questions" list
    When I search the list for "train"
    Then the search should find 2 results of 24
```

The second scenario reads the sample questions of the polls app that both ways of
step 1 make.

**5. Run it.** Set `LAUNCH_URL` to the address of the site:
`https://djangosteps.ddev.site` for the build script's site,
`https://djsite.ddev.site` for the Workspace's.

```bash
LAUNCH_URL=https://djangosteps.ddev.site npm test
```

A green first run prints every step, then the summary (the two scenarios above,
passed) and the HTML report it wrote:

```
2 scenarios (2 passed)
7 steps (7 passed)
0m03.000s (executing steps: 0m03.000s)
[webship-js] HTML report → …/django-tests/tests/reports/cucumber_report.html
```

One feature runs alone when the command line names it (a scenario too, with
its line):

```bash
LAUNCH_URL=https://djangosteps.ddev.site npx cucumber-js tests/features/first-run.feature
```

From there, copy the features of [`tests/features/`](tests/features/) (they
also ship in the package, under
`node_modules/@webship-js/django-steps/tests/features/`): together they use
every step of the pack. Each makes its own test objects and deletes them after
it. They run as they are on the site of either way of step 1.

### What the suite tests

The features of this repository run every step of the pack against the test
site, twice in a row in CI on every change, then the assertions that must fail:
each account logging in through the form and taking its session over, a refused
login, a visitor sent to the login page, logging out; the index as each account
sees it (the apps, the models, add, change or view), the recent actions, the
breadcrumbs, the navigation sidebar's filter and the colour theme kept from page
to page; the list of questions with its columns and cells, a search that finds
two and one that finds none, sorting both ways, a filter and its counts, the date
drill-down from a year to a month and back, the pages and "Show all"; the
selection of rows and across all pages, the "Delete selected" confirmation and
going back, an action without selected rows, the site's own action and the
deletion of two questions; the add form's sections, folding section, read-only
field and inline rows, a question added with every kind of field, the "Today" and
"Now" shortcuts, "Save and add another", a change saved, the autocomplete field
and the two-list selector, inline rows added, removed and deleted with the form,
a refused form and a date the form cannot read, a question added in a stacked
inline row of its category; a deletion with its related objects, going back from
one, a category a protected relation keeps, the history of an object, a deletion
in one step; the password change and four of its refusals; the accounts' status
and groups, the groups' permissions, the users list searched and filtered, a
group given its permissions with the two-list selector, a group name in use; the
view-only account with its read-only form and its refusals; and the landmarks of
the login page, the index and a list.

Every object a scenario makes is deleted after it, and a changed password is set
back: the suite leaves the site as it found it.

Not tested: the admin's popups (the "+" beside a related field opens the add form
of the other model in a window), the calendar and clock popups (the steps type the
date and time, or use the shortcuts), `list_editable` (no model of the test site
edits in its list), the password reset of the admin (a project wires it up itself),
a custom admin site other than the default one, and an admin in another language
than English (a few steps read the admin's English words: the "Clear all filters"
link and "Show counts").

## Requirements

- Node.js 24 or later
- A webship-js 2.0 test project (webship-js 2.0.16 or later)
- A Django project with the admin (`django.contrib.admin`), 5.2 or later, with
  staff accounts on it for the suite (a superuser among them, for the test-object
  steps)

## Install

```bash
npm install --save-dev @webship-js/django-steps
```

## How the steps find things and wait

- **By what a person reads.** A model by its plural name as the index shows it
  ("Questions"), an object by its text in the first column of its list, a field by
  its label (the colon left out), a field of an inline table row by its column, a
  filter by its title ("By category"), a column by its heading, a section by its
  heading, an action by its text. The admin's stable hooks are the fallback: the
  classes it puts on the body of each page (`change-list`, `change-form`,
  `delete-confirmation`, `dashboard`), the ids of its parts (`#result_list`,
  `#changelist-filter`, `#searchbar`, `#action-toggle`, `#user-tools`), and the
  classes of its links (`addlink`, `changelink`, `viewlink`, `historylink`,
  `deletelink`).
- **No fixed sleeps.** The admin draws its pages on the server: an action is a
  page load, and the steps wait for it. The widgets that work in the browser are
  set up by the admin's scripts when the page has loaded, and the steps wait for
  that: the autocomplete fields (their box drawn) and the two-list selectors (their
  "available" list drawn). The autocomplete field waits for the answer of the
  admin's autocomplete request to the typed text; the inline rows, the selectors,
  the folding sections and the action counter are checked until they show the
  change.
- **The two release lines.** The steps read what Django 5.2 and 6.1 both draw:
  the paginator's current page (`aria-current` on 6.1, `.this-page` on 5.2), the
  action button ("Run" on 6.1, "Go" on 5.2) by its name, a field's label whether
  it is a `label` or the `legend` of the field's own fieldset (6.1 draws the date
  and time and the many-to-many fields so).
- **A folded section opens** when a step sets a field in it, as a person opens it
  first.
- **A cut request says so.** When the browser shows its own error page
  (`chrome-error://`, a network change on the machine aborted the request), the
  step says that the request was cut before the site answered, with a hint to run
  the scenario again, instead of blaming the scenario. A login is sent again once.
- **Failures say what was found.** `The "By category" filter offers no "History".
  It offers: "All", "Food", "Music", …` with a hint on where to look.

## Accounts

The suite never creates or deletes an account: the test-object steps refuse to
make or delete one in the "Users" list. Accounts are configuration: list the ones
the site has in `worldParameters.users`, by a handle the scenarios use, each with
its `username` and `password`. `worldParameters.dataAdmin` names the handle of a
superuser: the test-object steps make and delete the test objects as that account,
through the admin's own forms, in a session of their own (the browser's session is
never touched), and set a password a scenario changed back.

An account that logged in once keeps its session for the rest of the run
(`reuseSessions: false` turns it off); a logout ends it.

## Test users

The accounts this repository's suite logs in as, exactly as `cucumber.js` lists
them in `worldParameters.users` (the default values; the `<HANDLE>_USERNAME`,
`<HANDLE>_PASSWORD` and `<HANDLE>_EMAIL` variables replace them). The build
script creates them; the Workspace's Django plugin creates the same three.

```json
{
  "administrator": { "username": "administrator", "password": "dD.123123ddd", "email": "administrator@example.com" },
  "editor": { "username": "editor", "password": "dD.123123ddd", "email": "editor@example.com" },
  "viewer": { "username": "viewer", "password": "dD.123123ddd", "email": "viewer@example.com" }
}
```

`administrator` is a superuser; `editor` is staff, in the group Editors, which
may add, change, delete and view the objects of the project's own apps (the polls);
`viewer` is staff, in the group Viewers, which may only view them. They are
placeholder credentials of a throwaway test site, not of any real one.

## A test site

[`.github/scripts/build-ddev-site.sh`](.github/scripts/build-ddev-site.sh)
builds the site the suite of this repository runs against, in a generic DDEV
project with PostgreSQL 16 and Node.js 24:

- Python in the web image ([uv](https://docs.astral.sh/uv/) and the Python it
  installs, 3.13 by default: the image's own Python is too old for Django 6.1 on
  some releases of DDEV), and the packages in a virtual environment of the project;
- `django-admin startproject mysite`, with Django of the line `DJANGO_VERSION`
  names (6.1 by default, 5.2 the long-term-support line) and the PostgreSQL driver;
- the settings of the container (`mysite/site_settings.py`, imported at the end of
  `settings.py`): the hosts, the proxy, the database, the mail catcher, and
  `DEBUG` off, as in production (a missing page is the 404 page, a refusal the 403
  page);
- the polls app of the official tutorial (parts 1 to 8), registered in the admin
  with what most projects use, added to the tutorial's admin: fieldsets (one that
  folds), the inline choices (a table), `list_display`, `list_filter`,
  `search_fields`, `date_hierarchy`, `list_per_page = 10`, an action ("Reset the
  votes of the selected questions"), a category (an autocomplete field, a stacked
  inline of its questions, a protected relation), tags (a two-list selector) and
  a read-only field ("Total votes");
- its sample data: 5 categories, 4 tags and 24 questions with their choices, from
  2025 and 2026 (the tutorial's "What's up?" among them);
- the site served by the web container (`manage.py runserver --insecure`, which
  serves the static files with `DEBUG` off), the router sending the project's
  address to it;
- the three accounts.

[`site/django-site.py`](site/django-site.py) writes all of it: the same script
the Webship Workspace's Django plugin runs. Run again with `ACCOUNTS_ONLY=1` and
the same `SITE_DIR`, the build script gives the accounts back their password,
address, staff status and group (after a run that was stopped half way).

The polls app is the official tutorial's, from the Django documentation, under its
BSD licence (see [`site/POLLS-LICENSE`](site/POLLS-LICENSE)); what this pack adds
to it is marked in the script.

## Steps

106 steps in 8 files, every one with five examples in its JSDoc (`npm run test:examples` checks them).

| File | Steps | Covers |
| --- | --- | --- |
| `django-session.steps.js` | 9 | The session: logging in by a handle or through the form, a refused login, a visitor, logging out, who is signed in, the login page. |
| `django-admin.steps.js` | 15 | The index (apps, models, add/change/view), a list by a model's name, the recent actions, the breadcrumbs, the navigation sidebar, the colour theme, the pages an account is refused. |
| `django-list.steps.js` | 29 | The change list: rows, columns, cells, the search, the count, sorting, the filters and their counts, the date drill-down, the pages, the selection, the actions. |
| `django-forms.steps.js` | 26 | The add and change forms: opening them, every kind of field by its label, read-only fields, sections, the autocomplete field, the two-list selector, saving, messages, errors, the view-only form. |
| `django-inlines.steps.js` | 8 | Inline rows, in a table or stacked: how many, adding, removing, marking for deletion, setting and reading a field, what they list. |
| `django-history.steps.js` | 9 | The delete confirmation (one object or the selected ones), confirming, going back, a refused deletion, a deletion in one step, the history page. |
| `django-accounts.steps.js` | 7 | The password change and its refusals; an account's status and groups; a group's permissions. |
| `django-data.steps.js` | 3 | Test objects made through the add form and deleted after the scenario; an object that must not be there; a check as the data administrator. |
| `django-helpers.js` | | Shared plumbing: the addresses of the admin, the waits on its page loads and widgets, the users registry and the session cache, the fields by their labels, the list, the inlines, the cut request, the test-data client. It registers no step. |

Text, links, buttons, the status code of a page and the accessibility checks are webship-js's own steps (`I should see "..."`, `I click "Delete"`, `the page should have a main landmark`); this pack adds what the admin decides.

### `django-session.steps.js` (9)

- `Given I am a logged in user with the "editor" user`
- `When I log in as "editor" with the login form`
- `When I log in with the user name "nobody" and the password "Wrong-password-1"`
- `Then the login should be refused with "Please enter the correct username and password for a staff account."`
- `Given I am not logged in`
- `When I log out`
- `Then I should be logged in as "editor"`
- `Then I should be logged in`
- `Then I should be on the admin login page`

### `django-admin.steps.js` (15)

- `Given I am on the admin index`
- `Then the admin index should list the app "Polls"`
- `Then the app "Polls" should list the model "Questions"`
- `Then I should be able to add "Questions"`
- `When I open the "Questions" list`
- `Then I should be on the "Questions" list`
- `Then my recent actions should list "Recent action question"`
- `Then the breadcrumbs should read "Home › Polls › Questions"`
- `When I follow "Polls" in the breadcrumbs`
- `When I filter the navigation sidebar with "quest"`
- `Then the navigation sidebar should show "Questions"`
- `When I open "Tags" from the navigation sidebar`
- `When I switch the admin theme to "dark"`
- `Then the admin theme should be "dark"`
- `Then I should not be allowed to open "/admin/auth/user/"`

### `django-list.steps.js` (29)

- `When I search the list for "train"`
- `Then the search should find 2 results`
- `Then the list should show "Which river is the longest?"`
- `Then the list should have 10 rows`
- `Then the list should count 24 questions`
- `Then the list columns should be "Question text", "Date published", "Category", "Published recently?"`
- `Then the "Which river is the longest?" row should show "Science" in the "Category" column`
- `Then the first row of the list should be "What's up?"`
- `Then "What's up?" should come before "Which fruit do you eat most?" in the list`
- `When I sort the list by "Date published"`
- `Then the list should be sorted by "Date published" in ascending order`
- `When I choose "Science" in the "By category" filter`
- `Then the "By category" filter should be set to "Science"`
- `When I clear all filters`
- `When I show the filter counts`
- `Then the "By category" filter should count 5 for "Science"`
- `When I choose "2025" in the date drill-down`
- `Then the date drill-down should offer "2025"`
- `When I go to page 2 of the list`
- `Then the list should be on page 2`
- `Then the list should have 3 pages`
- `When I show all rows of the list`
- `When I select "Which river is the longest?" in the list`
- `When I select all rows on the page`
- `When I select everything in the list`
- `When I clear the selection`
- `Then the selection should read "2 of 10 selected"`
- `Then the list should offer the action "Delete selected questions"`
- `When I run the action "Delete selected questions"`

### `django-forms.steps.js` (26)

- `When I open the add form of "Questions"`
- `When I open "Which river is the longest?" from the list`
- `When I open "What's up?" in the "Questions" list`
- `When I set "Question text" to "Who is there?"`
- `When I set these fields:`
- `Then "Question text" should be set to "Who is there?"`
- `Then "Total votes" should be read-only`
- `Then the form should have the section "Classification"`
- `Then the section "Classification" should have the field "Category"`
- `When I open the section "Date information"`
- `Then the section "Date information" should be closed`
- `When I type "Sci" in the "Category" autocomplete`
- `Then the "Category" autocomplete should offer "Science"`
- `When I choose "Science" in the "Category" autocomplete`
- `When I choose "Fun" in the "Tags" selector`
- `When I choose all in the "Tags" selector`
- `When I filter the available "Tags" with "Fu"`
- `Then the "Tags" selector should have "Fun" chosen`
- `When I save the form`
- `Then the form should be saved`
- `Then I should see the success message "The question “What is new?” was added successfully."`
- `Then the field "Question text" should have the error "This field is required."`
- `Then the form should show the error "Please correct the errors below."`
- `Then the form should have no errors`
- `Then I should see the "Add question" form`
- `Then the form should be read-only`

### `django-inlines.steps.js` (8)

- `Then the "Choices" inline should have 3 rows`
- `When I add a row to the "Choices" inline`
- `When I remove row 4 of the "Choices" inline`
- `Then row 2 of the "Choices" inline should be marked for deletion`
- `When I set "Choice text" to "Yes" in row 1 of the "Choices" inline`
- `When I fill in the "Choices" inline:`
- `Then row 1 of the "Choices" inline should have "Yes" in "Choice text"`
- `Then the "Choices" inline should list "Yes"`

### `django-history.steps.js` (9)

- `Then the delete confirmation should list "Question: Delete test question"`
- `Then the delete confirmation should count "Questions: 1"`
- `When I confirm the deletion`
- `When I cancel the deletion`
- `Then the deletion should be refused`
- `When I delete "Delete test question" from the "Questions" list`
- `When I open the history`
- `Then the history should list "Added."`
- `Then the history should have 1 entry`

### `django-accounts.steps.js` (7)

- `When I change my password to "Changed-pass-2026!"`
- `When I try to change my password with the old password "Not-the-password-1" and the new passwords "Changed-pass-2026!" and "Changed-pass-2026!"`
- `Then my password should be changed`
- `Then the password change should be refused with "Your old password was entered incorrectly. Please enter it again."`
- `Then the user "editor" should be staff`
- `Then the user "editor" should be in the "Editors" group`
- `Then the "Editors" group should have the "Polls | question | Can change question" permission`

### `django-data.steps.js` (3)

- `Given there is no "Data step question" in the "Questions" list`
- `Given there is a "Data step question" in the "Questions" list with:`
- `Then there should be a "Data step question" in the "Questions" list`

## Phrases shared with other packs

The session phrases are the ones every platform pack has, so a feature reads
the same on every system (one cucumber.js profile per system; the platform packs
are not meant to be loaded together). Loaded beside each of the 26 published
packs, these phrases of this pack also match one of theirs:

| Phrase of this pack | Also in |
| --- | --- |
| `I am a logged in user with the "editor" user` | codeigniter, django-cms, drupal-core, joomla, laravel, mediawiki, odoo, symfony, typo3, wordpress |
| `I am not logged in` | django-cms, drupal-core, joomla, odoo, typo3, wordpress |
| `I log out` | codeigniter, django-cms, drupal-core, laravel, mediawiki, odoo, symfony, typo3, wordpress |
| `I should be logged in` / `I should be logged in as "editor"` | backdrop-cms, codeigniter, django-cms, drupal-core, laravel, mediawiki, odoo, symfony, typo3, wordpress |
| `I log in as "editor" with the login form` | codeigniter, laravel, mediawiki, symfony |
| `I log in with the user name "…" and the password "…"`, `the login should be refused with "…"` | mediawiki |
| `I should be on the admin login page` | joomla |
| `I should see the success message "…"` | codeigniter, drupal-core, jira, joomla, magento, prestashop, symfony, woocommerce |
| `the user "editor" should be staff`, `the "Editors" group should have the "…" permission`, `I should not be allowed to open "…"` | django-cms |
| `the user "editor" should be in the "Editors" group` | django-cms, joomla |
| `I search the list for "…"` | joomla |
| `I sort the list by "…"`, `the first row of the list should be "…"` | ghost, prestashop |
| `the list should have 3 pages`, `I go to page 2 of the list`, `the list should be on page 2` | ghost, symfony |
| `the list should have 10 rows` | prestashop |
| `I save the form` | magento, odoo |
| `I confirm the deletion` | drupal-core |
| `I clear all filters` | shopify |
| `the search should find 2 results` | backdrop-cms, squarespace |
| `the form should show the error "…"` | squarespace |

None matches a webship-js step, and none matches a phrase of the component
pack (Bootstrap), which can be loaded beside this one.

The django CMS pack (`@webship-js/django-cms-steps`) works on the same admin, with
the CMS toolbar on top of it. Eight of its phrases are this pack's (the session,
an account's status and groups, a group's permissions, a refused address). Its
admin steps would hold on this pack's: django CMS serves the admin under a
language prefix, which `worldParameters.adminPath` (`/en/admin/`) gives.

## Testing this package

```bash
npm ci
npm run test:examples    # every step's JSDoc examples match it and nothing else; every feature step resolves
npm run test:paths       # a feature named on the command line runs alone
npx cucumber-js --dry-run
SITE_DIR="$PWD/../django-site" .github/scripts/build-ddev-site.sh
npx cucumber-js          # the whole suite
npm run test:must-fail   # the assertions that must fail, each with its message and a hint
```

## How the steps were written

Every step was written from a round of manual testing of a real local site in
the browser first, on both release lines: each screen it touches was opened, its
roles, labels and messages noted, and the signal it gives while it loads or saves
found. The failures of the first runs went back to the browser before the step
changed.

## License

MIT, see [LICENSE](LICENSE). The polls app the build script writes is the
official tutorial's, under the BSD licence of the Django documentation
([`site/POLLS-LICENSE`](site/POLLS-LICENSE)).

## Logo

The Django logo in this README comes from Simple Icons 16.37.0 (CC0-1.0), filled
with the colour the set lists for the brand. The Django name and logo are
trademarks of their owner; this pack is not affiliated with or endorsed by them.
