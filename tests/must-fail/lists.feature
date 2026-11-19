@must-fail
Feature: Assertions that must fail: the change list
  Each scenario ends with a step that asserts something that is not true on the test site.

  Background:
    Given I am a logged in user with the "editor" user
    And I am on the "Questions" list

  Scenario: A search counted wrong
    Fails with: The search found 2 results of 24 ("2 results (24 total)"), not 3.
    When I search the list for "train"
    Then the search should find 3 results

  Scenario: A row that the page does not show
    Fails with: The list does not show "What's up?" on this page.
    Then the list should show "What's up?"

  Scenario: A cell with another value
    Fails with: The "Which river is the longest?" row shows "Science" in the "Category" column, not "Travel".
    Then the "Which river is the longest?" row should show "Travel" in the "Category" column

  Scenario: A column that the list does not have
    Fails with: The list has no column "Votes".
    Then the "Which river is the longest?" row should show "6" in the "Votes" column

  Scenario: A sort order that the list is not in
    Fails with: The list is sorted by "Date published" in ascending order, not in descending order.
    When I sort the list by "Date published"
    Then the list should be sorted by "Date published" in descending order

  Scenario: A filter value that the filter does not offer
    Fails with: The "By category" filter offers no "History".
    When I choose "History" in the "By category" filter

  Scenario: A filter count off by one
    Fails with: The "By category" filter counts 5 for "Science", not 6.
    When I show the filter counts
    Then the "By category" filter should count 6 for "Science"

  Scenario: A page that the list does not have
    Fails with: The list has no page 7: it has 3 pages.
    When I go to page 7 of the list

  Scenario: A selection counted wrong
    Fails with: The action bar says "1 of 10 selected", not "2 of 10 selected".
    When I select "Which river is the longest?" in the list
    Then the selection should read "2 of 10 selected"

  Scenario: An action that the list does not offer
    Fails with: The list offers no action "Publish the selected questions".
    When I select "Which river is the longest?" in the list
    And I run the action "Publish the selected questions"
