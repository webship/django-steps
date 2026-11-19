@must-fail
Feature: Assertions that must fail: deletion, history, password and accounts
  Each scenario ends with a step that asserts something that is not true on the test site.

  Scenario: A protected category taken for a deletable one
    Fails with: The deletion cannot be confirmed: the page says "Cannot delete category".
    Given I am a logged in user with the "administrator" user
    When I open "Science" in the "Categories" list
    And I click "Delete"
    And I confirm the deletion

  Scenario: A related object that the deletion does not take
    Fails with: The delete confirmation does not list "Choice: Maybe".
    Given I am a logged in user with the "administrator" user
    When I open "What's up?" in the "Questions" list
    And I click "Delete"
    Then the delete confirmation should list "Choice: Maybe"

  Scenario: A history entry by another account
    Fails with: The history does not list "Added." by "editor".
    Given I am a logged in user with the "administrator" user
    When I open the history of "What's up?" in the "Questions" list
    Then the history should list "Added." by "editor"

  Scenario: A password refusal with another message
    Fails with: The password change was not refused with "This password is too short."
    Given I am a logged in user with the "editor" user
    When I try to change my password with the old password "Not-the-password-1" and the new passwords "Changed-pass-2026!" and "Changed-pass-2026!"
    Then the password change should be refused with "This password is too short."

  Scenario: A group that the account is not in
    Fails with: The user "editor" is not in the "Viewers" group. Its groups: "Editors".
    Given I am a logged in user with the "administrator" user
    Then the user "editor" should be in the "Viewers" group

  Scenario: A permission that the group does not have
    Fails with: The "Viewers" group does not have the "Can change question" permission.
    Given I am a logged in user with the "administrator" user
    Then the "Viewers" group should have the "Can change question" permission

  Scenario: An account is never deleted by a step
    Fails with: The steps never delete an account.
    Given there is no "editor" in the "Users" list
