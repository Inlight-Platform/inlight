## Reset faculty account password

The faculty user `819annietmail@gmail.com` exists in the database and the email is confirmed, but sign-in fails — meaning the stored password hash doesn't match `@Anniet819`. This happens when the original seed migration created the account via a path that didn't persist the intended password.

### Fix

Run a one-line migration that forces the password for this account back to `@Anniet819` using the auth admin update path (updating `auth.users.encrypted_password` via `crypt()` with the existing bcrypt settings). After it runs, signing in with:

- Email: `819annietmail@gmail.com`
- Password: `@Anniet819`

…will work, and the existing faculty role + Strasberg ownership stay intact (no other rows are touched).

### Out of scope

No UI changes, no changes to the Strasberg group, role, or membership data.