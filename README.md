# DoMaintenance
A domain table to give you an overview of your domains.

# Techlogy stack
- Frontend: Vite + React
- Backend: Rust
- Database: Postgres

# Features
- Public view pages:
    - Domain name, which can be hidden in different levels (e.g. original is example.com, we can show it as *******.com, or ***.com, even ***.***)
    - Registrator provider, which can be added and managed by users
    - Expiration date, use 365 days as standard, and show the remaining days until expiration like a progress bar with different colors (e.g. green for more than 180 days, yellow for 90-180 days, red for less than 90 days)
    - Renew price, which can be added and managed by users, allow user to set different currency. Also we need a total value of all domains in the list.
    - Notes, which can be added and managed by users, allow user to set different tags.
- Admin pages:
    - Add, edit, delete domain records
    - Add, edit, delete registrator providers
    - Add, edit, delete notes and tags
