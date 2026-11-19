@forms
Feature: Adding and changing an object with every kind of field
  As an editor
  I want the add and change forms to take every kind of value the model has
  So that a question goes in whole: its text, its date, its category, its tags and its choices

  Background:
    Given there is no "Form test question" in the "Questions" list
    And I am a logged in user with the "editor" user

  @critical
  Scenario: The add form shows its sections, its read-only field and its inline rows
    When I open the add form of "Questions"
    Then I should see the "Add question" form
    And the form should have the section "Date information"
    And the form should have the section "Classification"
    And the section "Date information" should be closed
    And the section "Classification" should have the field "Category"
    And the section "Classification" should have the field "Tags"
    And "Total votes" should be read-only and show "-"
    And the "Choices" inline should have 3 rows
    When I open the section "Date information"
    Then the section "Date information" should be open
    And the section "Date information" should have the field "Date published"

  Scenario: A question is added with a date, a category, tags and choices
    When I open the add form of "Questions"
    And I set "Question text" to "Form test question"
    And I set "Date published" to "2026-04-01 09:30:00"
    And I choose "Science" in the "Category" autocomplete
    And I choose "Fun, Serious" in the "Tags" selector
    And I fill in the "Choices" inline:
      | Choice text | Votes |
      | Yes         | 4     |
      | No          | 3     |
    And I save the form and continue editing
    Then the form should be saved
    And I should see the success message "The question “Form test question” was added successfully. You may edit it again below."
    And I should see the "Change question" form for "Form test question"
    And "Question text" should be set to "Form test question"
    And "Date published" should be set to "2026-04-01 09:30:00"
    And "Category" should be set to "Science"
    And "Tags" should be set to "Fun, Serious"
    And "Total votes" should be read-only and show "7"
    And row 1 of the "Choices" inline should have "Yes" in "Choice text"
    And row 2 of the "Choices" inline should have "3" in "Votes"

  Scenario: The shortcuts set the date and time to now
    When I open the add form of "Questions"
    And I set "Question text" to "Form test question"
    And I set "Date published" to "now"
    And I save the form
    Then the form should be saved
    And I should be on the "Questions" list
    And the "Form test question" row should show "yes" in the "Published recently?" column

  Scenario: Save and add another opens a new add form
    When I open the add form of "Questions"
    And I set these fields:
      | Question text  | Form test question  |
      | Date published | 2026-04-02 10:00:00 |
    And I save the form and add another
    Then I should see the success message "You may add another question below."
    And I should see the "Add question" form
    And "Question text" should be set to ""

  Scenario: An object is changed and the change is saved
    Given there is a "Form test question" in the "Questions" list with:
      | Question text  | Form test question  |
      | Date published | 2026-04-03 11:00:00 |
      | Category       | Travel              |
    When I open "Form test question" in the "Questions" list
    Then "Category" should be set to "Travel"
    When I choose "Food" in the "Category" autocomplete
    And I save the form
    Then I should see the success message "The question “Form test question” was changed successfully."
    When I search the list for "Form test question"
    Then the "Form test question" row should show "Food" in the "Category" column

  Scenario: The autocomplete field searches as you type
    When I open the add form of "Questions"
    And I type "Tra" in the "Category" autocomplete
    Then the "Category" autocomplete should offer "Travel"
    And the "Category" autocomplete should not offer "Science"

  Scenario: The two-list selector moves and filters its options
    When I open the add form of "Questions"
    Then the "Tags" selector should have "Fun" available
    When I choose "Fun" in the "Tags" selector
    Then the "Tags" selector should have "Fun" chosen
    And the "Tags" selector should not have "Fun" available
    When I filter the available "Tags" with "Se"
    Then the "Tags" selector should have "Serious" available
    And the "Tags" selector should not have "Long" available
    When I remove "Fun" from the "Tags" selector
    Then the "Tags" selector should not have "Fun" chosen
    When I choose all in the "Tags" selector
    Then "Tags" should be set to "Serious"

  Scenario: Inline rows are added and removed
    When I open the add form of "Questions"
    Then the "Choices" inline should have 3 rows
    When I add a row to the "Choices" inline
    Then the "Choices" inline should have 4 rows
    When I set "Choice text" to "Maybe" in row 4 of the "Choices" inline
    Then the "Choices" inline should list "Maybe"
    When I remove row 4 of the "Choices" inline
    Then the "Choices" inline should have 3 rows
    And the "Choices" inline should not list "Maybe"

  Scenario: A saved inline row is deleted with the form
    When I open the add form of "Questions"
    And I set "Question text" to "Form test question"
    And I set "Date published" to "2026-04-04 12:00:00"
    And I fill in the "Choices" inline:
      | Choice text |
      | Keep me     |
      | Delete me   |
    And I save the form and continue editing
    And I remove row 2 of the "Choices" inline
    Then row 2 of the "Choices" inline should be marked for deletion
    When I save the form and continue editing
    Then the "Choices" inline should list "Keep me"
    And the "Choices" inline should not list "Delete me"

  Scenario: A refused form says what is missing and keeps what was typed
    When I open the add form of "Questions"
    And I set "Category" to "Music"
    And I save the form
    Then the form should show the error "Please correct the errors below."
    And the field "Question text" should have the error "This field is required."
    And the field "Date published" should have the error "This field is required."
    And the section "Date information" should be open
    And "Category" should be set to "Music"

  Scenario: A date the form cannot read is refused
    When I open the add form of "Questions"
    And I set "Question text" to "Form test question"
    And I set "Date published" to "2026-13-45 10:00:00"
    And I save the form
    Then the field "Date published" should have the error "Enter a valid date."
    And there should be no "Form test question" in the "Questions" list

  Scenario: A question is added from its category's page, in a stacked inline row
    Given there is no "Inline test question" in the "Questions" list
    And I open "Music" in the "Categories" list
    Then the "Questions" inline should have 5 rows
    And the "Questions" inline should list "Which instrument would you learn?"
    When I set "Question text" to "Inline test question" in row 5 of the "Questions" inline
    And I set "Date published" to "2026-04-05 09:00:00" in row 5 of the "Questions" inline
    And I save the form and continue editing
    Then the form should be saved
    And the "Questions" inline should list "Inline test question"
    And there should be an "Inline test question" in the "Questions" list
