# Create UTOPIA Owners - Instructions

This script will create 11 unique owner accounts for the UTOPIA yacht using their phone numbers as passwords.

## Users to be created:

1. Ralph Sorbonne - rlsorbonne@gmail.com - Password: 8014552001
2. Chip Brewster - brouha@hotmail.com - Password: 8015628801
3. Greg Brown - gregbrown646@gmail.com - Password: 8016526191
4. Jeff Flamm - jflamm@eyeqadvantage.com - Password: 8012098000
5. Wade Williams - wwisme@mac.com - Password: 8015562181
6. Dick Miles - dickm@wslm.biz - Password: 8019498530
7. Joe Ham - joeham7@gmail.com - Password: 7144086000
8. Rick Bartholomew - rickbart@reagan.com - Password: 8013809519
9. Curtis McEntire - curtis.mcentire@outlook.com - Password: 8014195251
10. Ken Webster - websterlisa@comcast.net - Password: 8012014377
11. Andrew Bartholomew - drewbart@reagan.com - Password: 8019600362

## How to Run:

1. Open a terminal in the project directory
2. Load the environment variables and run the script:

```bash
source .env && node create-utopia-owners.js
```

Or on Windows:

```bash
set -a && . .env && node create-utopia-owners.js
```

## What the script does:

- Creates each user with role 'owner'
- Assigns them to the UTOPIA yacht
- Sets their phone number (without dashes) as their temporary password
- Enables email notifications by default
- Sets `must_change_password` to true (they'll be prompted to change password on first login)
- Handles duplicates (removed from the list)

## After Creation:

All users will be able to log in with:
- Email: Their email address from the list
- Password: Their phone number without dashes (e.g., 8014552001)

They will be prompted to change their password after their first login.

## Notes:

- The script includes a 500ms delay between each user creation to avoid rate limiting
- Any errors will be logged to the console
- If a user already exists, the script will show an error but continue with the remaining users
