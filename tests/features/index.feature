@index
Feature: The admin index, its navigation and what each account may do
  As a member of the staff
  I want the admin to show me the apps and models I work with, and only those
  So that I find my work, and nobody reaches the data they may not change

  @critical
  Scenario: The administrator sees every app and model
    Given I am a logged in user with the "administrator" user
    When I open the admin index
    Then the admin index should list the app "Polls"
    And the admin index should list the app "Authentication and Authorization"
    And the app "Polls" should list the model "Questions"
    And the app "Polls" should list the model "Categories"
    And the app "Authentication and Authorization" should list the model "Users"
    And the app "Polls" should not list the model "Choices"
    And I should be able to add "Users"

  Scenario: The editor sees the polls, not the accounts
    Given I am a logged in user with the "editor" user
    When I open the admin index
    Then the admin index should list the app "Polls"
    And the admin index should not list the app "Authentication and Authorization"
    And I should be able to add "Questions"
    And I should be able to change "Tags"

  Scenario: The viewer may view the polls and nothing more
    Given I am a logged in user with the "viewer" user
    When I open the admin index
    Then I should be able to view "Questions"
    And I should not be able to add "Questions"
    And I should not be able to change "Questions"
    And the admin index should not list the app "Authentication and Authorization"

  Scenario: An object the editor adds shows in the recent actions
    Given there is no "Recent action question" in the "Questions" list
    And I am a logged in user with the "editor" user
    When I open the add form of "Questions"
    And I set "Question text" to "Recent action question"
    And I set "Date published" to "now"
    And I save the form
    Then the form should be saved
    And my recent actions should list "Recent action question" as added

  Scenario: The breadcrumbs lead from a form back to the index
    Given I am a logged in user with the "editor" user
    When I open the add form of "Questions"
    Then the breadcrumbs should read "Home › Polls › Questions › Add question"
    When I follow "Questions" in the breadcrumbs
    Then I should be on the "Questions" list
    And the breadcrumbs should read "Home › Polls › Questions"
    When I follow "Home" in the breadcrumbs
    Then I should see "Site administration"

  Scenario: The navigation sidebar filters the models
    Given I am a logged in user with the "administrator" user
    And I am on the "Questions" list
    Then the navigation sidebar should show "Users"
    When I filter the navigation sidebar with "tag"
    Then the navigation sidebar should show "Tags"
    And the navigation sidebar should not show "Users"
    When I open "Tags" from the navigation sidebar
    Then I should be on the "Tags" list

  Scenario: The colour theme is kept from page to page
    Given I am a logged in user with the "viewer" user
    And I am on the "Questions" list
    When I switch the admin theme to "dark"
    Then the admin theme should be "dark"
    When I open the admin index
    Then the admin theme should be "dark"
    When I switch the admin theme to "auto"
    Then the admin theme should be "auto"
