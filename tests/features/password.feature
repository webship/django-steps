@password
Feature: Changing one's own password
  As a member of the staff
  I want to change my password in the admin, and the admin to refuse a weak or mistyped one
  So that my account stays mine

  A changed password is set back after the scenario: the accounts are configuration.

  Background:
    Given I am a logged in user with the "editor" user

  Scenario: A wrong old password is refused
    When I try to change my password with the old password "Not-the-password-1" and the new passwords "Changed-pass-2026!" and "Changed-pass-2026!"
    Then the password change should be refused with "Your old password was entered incorrectly. Please enter it again."

  Scenario: Two different new passwords are refused
    When I try to change my password with my old password and the new passwords "Changed-pass-2026!" and "Changed-pass-2026?"
    Then the password change should be refused with "The two password fields didn’t match."

  Scenario: A common password is refused
    When I try to change my password with my old password and the new passwords "password123" and "password123"
    Then the password change should be refused with "This password is too common."

  Scenario: A password of digits only is refused
    When I try to change my password with my old password and the new passwords "40571368294" and "40571368294"
    Then the password change should be refused with "This password is entirely numeric."

  Scenario: The password is changed, and the new one logs in
    When I change my password to "Changed-pass-2026!"
    Then my password should be changed
    When I log out
    And I log in with the user name "editor" and the password "Changed-pass-2026!"
    Then I should be logged in as "editor"
