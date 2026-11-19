@must-fail
Feature: Assertions that must fail: the session and the index
  Each scenario ends with a step that asserts something that is not true on the test site.
  tests/check-must-fail.js runs them and checks that each fails at its last step with its message.

  Scenario: Another account is signed in
    Fails with: The admin greets "viewer", not "editor".
    Given I am a logged in user with the "viewer" user
    Then I should be logged in as "editor"

  Scenario: A refusal with another message
    Fails with: The login page did not refuse the login with "Your account is locked."
    Given I am not logged in
    When I log in with the user name "nobody at all" and the password "Wrong-password-1"
    Then the login should be refused with "Your account is locked."

  Scenario: An account that is not in the registry
    Fails with: The user "auditor" is not in the users registry. Known users: administrator, editor, viewer.
    Given I am a logged in user with the "auditor" user

  Scenario: The editor does not see the accounts
    Fails with: The admin index does not list the app "Authentication and Authorization". It lists: "Polls".
    Given I am a logged in user with the "editor" user
    Then the admin index should list the app "Authentication and Authorization"

  Scenario: The viewer may not add
    Fails with: The admin index does not offer to add "Questions": it offers view.
    Given I am a logged in user with the "viewer" user
    Then I should be able to add "Questions"

  Scenario: Breadcrumbs that are not the page's
    Fails with: The breadcrumbs read "Home › Polls › Questions", not "Home › Polls › Tags"
    Given I am a logged in user with the "editor" user
    And I am on the "Questions" list
    Then the breadcrumbs should read "Home › Polls › Tags"

  Scenario: A model the admin does not have
    Fails with: The admin index lists no model "Answers".
    Given I am a logged in user with the "editor" user
    When I open the "Answers" list

  @js-off
  Scenario: A refused page taken for an allowed one
    Fails with: The site refused "/admin/auth/user/" (HTTP 403)
    Given I am a logged in user with the "editor" user
    Then I should be allowed to open "/admin/auth/user/"
