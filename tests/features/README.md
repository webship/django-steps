# Features

Reference features for the test site that `.github/scripts/build-ddev-site.sh`
builds (or the Webship Workspace's builder, with `--install --add-users
--polls`): a plain project with the polls app of the official tutorial,
registered in the admin, its sample data (5 categories, 4 tags, 24 questions), and
the three accounts of `cucumber.js` (`administrator`, `editor`, `viewer`). Each
scenario makes the objects it needs and deletes them after it, so a feature runs
as it is on any such site.

| Feature | Covers |
| --- | --- |
| `session` | Each account logging in through the form, a refused login, a visitor sent to the login page, logging out, a session taken over. |
| `index` | The index as each account sees it, the recent actions, the breadcrumbs, the navigation sidebar, the colour theme. |
| `change-list` | The columns and cells, a search, sorting both ways, a filter and its counts, the date drill-down, the pages. |
| `actions` | The selection of rows and across pages, "Delete selected" and going back, an action without rows, the site's own action, a confirmed deletion. |
| `add-and-change` | The add form's sections and inline rows, every kind of field, the date shortcuts, the save buttons, the autocomplete field, the two-list selector, inline rows, a refused form, a stacked inline. |
| `delete-and-history` | A deletion with its related objects, going back, a protected category, the history, a deletion in one step. |
| `password` | The password change and four of its refusals; the password is set back after the scenario. |
| `users-and-groups` | The accounts' status and groups, the groups' permissions, the users list, a group given its permissions, a name in use, the editor refused the accounts. |
| `view-only` | The view-only account: its list, its read-only form, its refusals. |
| `accessibility` | The landmarks of the login page, the index and a list. |

The assertions that must fail are in `tests/must-fail/` (`npm run test:must-fail`).
