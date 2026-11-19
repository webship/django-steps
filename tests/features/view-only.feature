@view-only
Feature: An account that may only view
  As the administrator
  I want an account with only the view permission to read the polls without changing them
  So that a reviewer sees everything and breaks nothing

  Background:
    Given I am a logged in user with the "viewer" user

  @critical
  Scenario: The list has no add button and no actions
    Given I am on the "Questions" list
    Then I should see "Select question to view"
    And the list should not offer the action "Delete selected questions"
    And I should not see "Add question"
    And the list should count 24 questions

  Scenario: An object opens in a read-only form
    Given I am on the "Questions" list
    When I search the list for "What's up"
    And I open "What's up?" from the list
    Then I should see the "View question" form for "What's up?"
    And the form should be read-only
    And "Question text" should be read-only and show "What's up?"
    And "Tags" should be read-only and show "Fun, Quick"
    And the "Choices" inline should list "The sky"
    And I should see "Close"

  @js-off
  Scenario: The forms that change are refused
    Then I should not be allowed to open "/admin/polls/question/add/"
    And I should not be allowed to open "/admin/auth/user/"
    And I should be allowed to open "/admin/polls/question/"
