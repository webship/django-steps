@must-fail
Feature: Assertions that must fail: the forms and their inline rows
  Each scenario ends with a step that asserts something that is not true on the test site.

  Background:
    Given I am a logged in user with the "editor" user
    And I open the add form of "Questions"

  Scenario: A field that the form does not have
    Fails with: The form has no field "Answer text". Its fields:
    When I set "Answer text" to "Hello"

  Scenario: A read-only field taken for an input
    Fails with: The field "Total votes" is read-only: it shows "-" and takes no value.
    When I set "Total votes" to "3"

  Scenario: An autocomplete answer that does not exist
    Fails with: The autocomplete field "Category" offers no "History" for that text.
    When I choose "History" in the "Category" autocomplete

  Scenario: An option that the selector does not have
    Fails with: The available "Tags" have no "Urgent".
    When I choose "Urgent" in the "Tags" selector

  Scenario: A section that is not open
    Fails with: The section "Date information" is closed, not open.
    Then the section "Date information" should be open

  Scenario: An input taken for a read-only field
    Fails with: The field "Question text" is not read-only: it is an input (text).
    Then "Question text" should be read-only

  Scenario: An inline row that the form does not have
    Fails with: The inline "Choices" has no row 7: it has 3 rows.
    When I set "Choice text" to "Yes" in row 7 of the "Choices" inline

  Scenario: An inline counted wrong
    Fails with: The inline "Choices" has 3 rows, not 5.
    Then the "Choices" inline should have 5 rows

  Scenario: A refused form taken for a saved one
    Fails with: The admin refused the form:
    When I save the form
    Then the form should be saved

  Scenario: A field error that the form does not show
    Fails with: The field "Question text" does not have the error "Ensure this value has at most 200 characters". Its errors: "This field is required."
    When I save the form
    Then the field "Question text" should have the error "Ensure this value has at most 200 characters"
