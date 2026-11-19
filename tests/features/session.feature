@session
Feature: Logging in to the admin and out of it
  As a member of the staff
  I want to log in to the admin with my account and to log out
  So that only the staff works on the site's data, each with their own permissions

  The accounts are the ones of the users registry in cucumber.js: the build of the site makes them.

  @critical
  Scenario: The editor logs in with the login form
    Given I am not logged in
    When I log in as "editor" with the login form
    Then I should be logged in as "editor"
    And I should see "Site administration"

  Scenario Outline: The <account> account logs in
    Given I am not logged in
    When I log in as "<account>" with the login form
    Then I should be logged in as "<account>"

    Examples:
      | account       |
      | administrator |
      | editor        |
      | viewer        |

  Scenario: A wrong password is refused
    Given I am not logged in
    When I log in with the user name "nobody at all" and the password "Wrong-password-1"
    Then the login should be refused with "Please enter the correct username and password for a staff account."
    And I should not be logged in

  Scenario: A visitor who opens the admin is sent to its login page
    Given I am not logged in
    When I open the admin index
    Then I should be on the admin login page
    And I should not be logged in

  Scenario: Logging out ends the session
    Given I am a logged in user with the "editor" user
    When I log out
    Then I should see "Logged out"
    And I should not be logged in
    When I open the admin index
    Then I should be on the admin login page

  Scenario: A session opened earlier in the run is taken over
    Given I am a logged in user with the "viewer" user
    Then I should be logged in as "viewer"
    Given I am a logged in user with the "editor" user
    Then I should be logged in as "editor"
