@accessibility
Feature: The landmarks of the admin's pages
  As a person who uses a screen reader or a keyboard
  I want every page of the admin to have its landmarks, its language and one main heading
  So that I move through the admin as easily as anyone

  Scenario: The login page
    Given I am not logged in
    Then the page should have a main landmark
    And the page should have a skip link
    And the page should declare a language
    And every form field should have an accessible label

  Scenario: The index and a list
    Given I am a logged in user with the "editor" user
    When I open the admin index
    Then the page should have a main landmark
    And the page should have exactly one h1
    When I open the "Questions" list
    Then the page should have a navigation landmark
    And the page should have exactly one h1
