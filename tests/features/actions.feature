@actions
Feature: Selecting rows of a list and running an action on them
  As an editor
  I want to act on several questions at once
  So that a change to many takes one step, and a deletion asks me first

  Background:
    Given there is no "Action test question one" in the "Questions" list
    And there is no "Action test question two" in the "Questions" list
    And I am a logged in user with the "editor" user

  Scenario: The action bar counts the selected rows
    Given I am on the "Questions" list
    When I select "Which river is the longest?" in the list
    And I select "Which season do you like best?" in the list
    Then the selection should read "2 of 10 selected"
    When I unselect "Which season do you like best?" in the list
    Then the selection should read "1 of 10 selected"

  Scenario: Every row of the list, on all its pages, is selected and the selection cleared
    Given I am on the "Questions" list
    When I select everything in the list
    Then the selection should read "All 24 selected"
    When I clear the selection
    Then the selection should read "0 of 10 selected"

  Scenario: The deletion of the selected rows asks first, and going back deletes nothing
    Given I am on the "Questions" list
    When I select all rows on the page
    And I run the action "Delete selected questions"
    Then the delete confirmation should count "Questions: 10"
    And the delete confirmation should list "Question: Which river is the longest?"
    And the delete confirmation should list "Choice: The Nile"
    When I cancel the deletion
    Then I should be on the "Questions" list
    And the list should count 24 questions

  Scenario: An action needs selected rows
    Given I am on the "Questions" list
    When I run the action "Delete selected questions"
    Then I should see the warning message "Items must be selected in order to perform actions on them. No items have been changed."

  Scenario: The action of the site resets the votes of the selected questions
    Given there is a "Action test question one" in the "Questions" list with:
      | Question text  | Action test question one |
      | Date published | 2026-03-01 10:00:00      |
    And there is a "Action test question two" in the "Questions" list with:
      | Question text  | Action test question two |
      | Date published | 2026-03-02 10:00:00      |
    When I open "Action test question one" in the "Questions" list
    And I fill in the "Choices" inline:
      | Choice text | Votes |
      | Yes         | 5     |
      | No          | 3     |
    And I save the form and continue editing
    Then "Total votes" should be read-only and show "8"
    When I open the "Questions" list
    And I search the list for "Action test question"
    And I select "Action test question one" in the list
    And I select "Action test question two" in the list
    And I run the action "Reset the votes of the selected questions"
    Then I should see the success message "The votes of 2 questions were reset."
    When I open "Action test question one" in the "Questions" list
    Then "Total votes" should be read-only and show "0"

  Scenario: The selected rows are deleted once the deletion is confirmed
    Given there is a "Action test question one" in the "Questions" list with:
      | Question text  | Action test question one |
      | Date published | 2026-03-01 10:00:00      |
    And there is a "Action test question two" in the "Questions" list with:
      | Question text  | Action test question two |
      | Date published | 2026-03-02 10:00:00      |
    And I am on the "Questions" list
    When I search the list for "Action test question"
    And I select all rows on the page
    And I run the action "Delete selected questions"
    Then the delete confirmation should count "Questions: 2"
    When I confirm the deletion
    Then I should see the success message "Successfully deleted 2 questions."
    And there should be no "Action test question one" in the "Questions" list
    And there should be no "Action test question two" in the "Questions" list
