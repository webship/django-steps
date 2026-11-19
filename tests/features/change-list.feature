@change-list
Feature: The list of a model: search, filters, sorting, dates and pages
  As an editor
  I want to find the objects I work on in a long list
  So that I open the right one without reading every page

  The list of questions has the 24 sample questions of the build: 10 a page, in 5 categories, from 2025 and 2026.

  Background:
    Given I am a logged in user with the "editor" user
    And I am on the "Questions" list

  @critical
  Scenario: The list shows its columns and counts every row
    Then the list columns should be "Question text", "Date published", "Category", "Published recently?"
    And the list should count 24 questions
    And the list should have 10 rows
    And the "Which river is the longest?" row should show "Science" in the "Category" column
    And the "Which river is the longest?" row should show "no" in the "Published recently?" column

  Scenario: A search finds the questions with a word
    When I search the list for "train"
    Then the search should find 2 results of 24
    And the list should show "Do you travel by train or by plane?"
    And the list should show "Which train journey is the most beautiful?"
    And the list should not show "What's up?"

  Scenario: A search that finds nothing
    When I search the list for "no question has these words"
    Then the search should find 0 results of 24
    And the list should count 0 questions

  Scenario: The list sorts by a column, both ways
    When I sort the list by "Date published"
    Then the list should be sorted by "Date published" in ascending order
    And the first row of the list should be "What's up?"
    And "What's up?" should come before "Which fruit do you eat most?" in the list
    When I sort the list by "Date published" in descending order
    Then the list should be sorted by "Date published" in descending order
    And the first row of the list should be "Which breakfast keeps you going?"

  Scenario: A filter keeps the questions of one category
    When I choose "Science" in the "By category" filter
    Then the "By category" filter should be set to "Science"
    And the list should count 5 questions
    And the list should show "Which river is the longest?"
    When I clear all filters
    Then the "By category" filter should be set to "All"
    And the list should count 24 questions

  Scenario: The filter counts say how many rows each value keeps
    When I show the filter counts
    Then the "By category" filter should count 5 for "Science"
    And the "By category" filter should count 4 for "Travel"
    And the "By category" filter should count 2 for "-"

  Scenario: The date drill-down goes from a year to a month
    Then the date drill-down should offer "2025"
    And the date drill-down should offer "2026"
    When I choose "2025" in the date drill-down
    Then the list should count 12 questions
    And the date drill-down should offer "January 2025"
    When I choose "January 2025" in the date drill-down
    Then the list should count 1 question
    And the list should show "What's up?"
    When I choose "2025" in the date drill-down
    Then the list should count 12 questions
    When I choose "All dates" in the date drill-down
    Then the list should count 24 questions

  Scenario: The pages of the list
    Then the list should have 3 pages
    And the list should be on page 1
    When I go to page 3 of the list
    Then the list should be on page 3
    And the list should have 4 rows
    When I show all rows of the list
    Then the list should have 24 rows
