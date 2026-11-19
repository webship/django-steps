@delete @history
Feature: Deleting an object, and the history of its changes
  As an editor
  I want the admin to show me what a deletion takes with it, and to keep the history of each object
  So that nothing is deleted by surprise, and every change can be traced to its author

  Background:
    Given there is no "Delete test question" in the "Questions" list
    And there is no "History test question" in the "Questions" list
    And I am a logged in user with the "editor" user

  Scenario: The deletion lists the related objects it takes, then deletes them
    When I open the add form of "Questions"
    And I set "Question text" to "Delete test question"
    And I set "Date published" to "2026-05-01 10:00:00"
    And I fill in the "Choices" inline:
      | Choice text |
      | Yes         |
      | No          |
    And I save the form and continue editing
    And I click "Delete"
    Then the delete confirmation should list "Question: Delete test question"
    And the delete confirmation should list "Choice: Yes"
    And the delete confirmation should list "Choice: No"
    And the delete confirmation should count "Choices: 2"
    When I confirm the deletion
    Then I should see the success message "The question “Delete test question” was deleted successfully."
    And there should be no "Delete test question" in the "Questions" list

  Scenario: Going back from the deletion deletes nothing
    Given there is a "Delete test question" in the "Questions" list with:
      | Question text  | Delete test question |
      | Date published | 2026-05-02 10:00:00  |
    When I open "Delete test question" in the "Questions" list
    And I click "Delete"
    Then the delete confirmation should count "Questions: 1"
    When I cancel the deletion
    Then I should see the "Change question" form for "Delete test question"
    And there should be a "Delete test question" in the "Questions" list

  Scenario: A category that questions are in cannot be deleted
    Given I am a logged in user with the "administrator" user
    When I open "Science" in the "Categories" list
    And I click "Delete"
    Then the deletion should be refused because of "Question: Which river is the longest?"
    And there should be a "Science" in the "Categories" list

  Scenario: The history lists who added and who changed an object
    Given there is a "History test question" in the "Questions" list with:
      | Question text  | History test question |
      | Date published | 2026-05-03 10:00:00   |
    When I open "History test question" in the "Questions" list
    And I set "Category" to "Sport"
    And I save the form and continue editing
    And I open the history
    Then the history should have 2 entries
    And the history should list "Added." by "administrator"
    And the history should list "Changed Category." by "editor"
    And the history should not list "Deleted"

  Scenario: An object is deleted from its list in one step
    Given there is a "Delete test question" in the "Questions" list with:
      | Question text  | Delete test question |
      | Date published | 2026-05-04 10:00:00  |
    When I delete "Delete test question" from the "Questions" list
    Then I should see the success message "was deleted successfully"
    And there should be no "Delete test question" in the "Questions" list
