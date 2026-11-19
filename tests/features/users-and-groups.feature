@users
Feature: The accounts and the groups of the admin
  As the administrator
  I want to see each account's status and groups, and to give a group its permissions
  So that every member of the staff can do their work, and no more

  No scenario creates or deletes an account: the accounts are configuration.

  Background:
    Given I am a logged in user with the "administrator" user

  @critical
  Scenario: The accounts of the site and their groups
    Then the user "administrator" should be a superuser
    And the user "editor" should be staff
    And the user "editor" should not be a superuser
    And the user "editor" should be in the "Editors" group
    And the user "viewer" should be in the "Viewers" group
    And the user "viewer" should be active

  Scenario: The groups carry the permissions of their members
    Then the "Editors" group should have the "Polls | question | Can change question" permission
    And the "Editors" group should have the "Can delete question" permission
    And the "Viewers" group should have the "Can view question" permission
    And the "Viewers" group should not have the "Can change question" permission

  Scenario: The users list is searched and filtered
    Given I am on the "Users" list
    When I search the list for "edit"
    Then the list should show "editor"
    And the list should not show "viewer"
    When I search the list for ""
    And I choose "Viewers" in the "By groups" filter
    Then the list should show "viewer"
    And the list should not show "editor"
    And the "viewer" row should show "yes" in the "Staff status" column

  Scenario: A group gets its permissions with the two-list selector
    Given there is no "Reviewers" in the "Groups" list
    When I open the add form of "Groups"
    And I set "Name" to "Reviewers"
    And I filter the available "Permissions" with "can view question"
    And I choose "Polls | question | Can view question" in the "Permissions" selector
    Then the "Permissions" selector should have "Polls | question | Can view question" chosen
    When I save the form
    Then I should see the success message "The group “Reviewers” was added successfully."
    And the "Reviewers" group should have the "Can view question" permission
    And the "Reviewers" group should not have the "Can change question" permission

  Scenario: A group name in use is refused
    When I open the add form of "Groups"
    And I set "Name" to "Editors"
    And I save the form
    Then the field "Name" should have the error "Group with this Name already exists."

  @js-off
  Scenario: The editor may not open the accounts
    Given I am a logged in user with the "editor" user
    Then I should not be allowed to open "/admin/auth/user/"
    And I should not be allowed to open "/admin/auth/group/add/"
    And I should be allowed to open "/admin/polls/question/"
