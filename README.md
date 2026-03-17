# DoMaintenance

A self-hosted domain maintenance dashboard for tracking domains, registrars, renewal pricing, registration and expiration timestamps, and related operational metadata.

## Features

- **Domain lifecycle tracking** - Track registration time, expiration time, renewal cycle, renewal price, and remaining time
- **Admin management panel** - Manage domains, registrars, tags, currencies, and runtime settings
- **Public dashboard** - Share a read-only overview with masked domains, registrar info, expiration status, and totals
- **Automated date refresh** - Refresh domain dates manually or on a schedule with RDAP/WHOIS-based lookups
- **Backup and restore** - Export and import full project backups with `database.sql` and favicon assets
- **Localization** - English and Simplified Chinese

## Stack

- **Frontend** - Vite, React, TypeScript, Tailwind CSS
- **Backend** - Rust, Axum, SeaORM
- **Database** - PostgreSQL

---

## How to install (Ubuntu as example)

### Prerequisites

- Rust toolchain
- Node.js 20+
- npm
- PostgreSQL
- Nginx
- `pg_dump` and `psql`
- Build dependencies:

```bash
sudo apt update
sudo apt install -y build-essential pkg-config libssl-dev nginx postgresql postgresql-contrib
```

Install Rust if needed:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
```

Install Node.js if needed. One simple option is `nvm`:

```bash
# Download and install nvm:
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.4/install.sh | bash
# in lieu of restarting the shell
\. "$HOME/.nvm/nvm.sh"
# Download and install Node.js:
nvm install 24
# Verify the Node.js version:
node -v # Should print "v24.14.0".
```

### Step 1: Clone Repository

```bash
cd ~
git clone https://github.com/Doublefire-Chen/DoMaintenance.git
cd DoMaintenance
```

### Step 2: Database Setup

Open PostgreSQL:

```bash
sudo -u postgres psql
```

Create a database and user:

```sql
CREATE USER domaintenance WITH PASSWORD 'strong-password';
CREATE DATABASE domaintenance OWNER domaintenance;
GRANT ALL PRIVILEGES ON DATABASE domaintenance TO domaintenance;
```

Load the schema:

```bash
psql "postgres://domaintenance:strong-password@localhost:5432/domaintenance" -f db_schema/schema.sql
```

### Step 3: Build Application

#### Build backend

```bash
cd ~/DoMaintenance/backend
cp .env.example .env
vim .env
```

Example backend `.env`:

```env
DATABASE_URL=postgres://domaintenance:strong-password@localhost:5432/domaintenance
SERVER_HOST=127.0.0.1
SERVER_PORT=3000
FRONTEND_URL=https://domains.example.com
RUST_LOG=info
```

Build release binary:

```bash
cargo build --release
```

Install the backend:

```bash
sudo mkdir -p /opt/domaintenance
sudo cp target/release/domaintenance-backend /opt/domaintenance/backend
sudo cp .env /opt/domaintenance/.env
sudo mkdir -p /opt/domaintenance/storage
sudo chown -R www-data:www-data /opt/domaintenance
sudo chmod -R 755 /opt/domaintenance
```

#### Build frontend

```bash
cd ~/DoMaintenance/frontend
npm install
cp .env.example .env
vim .env
```

Example frontend `.env`:

```env
VITE_API_URL=https://api.example.com
```

Build the frontend:

```bash
npm run build
```

Install the built files:

```bash
sudo mkdir -p /var/www/domaintenance
sudo cp -r dist/* /var/www/domaintenance/
```

### Step 4: Create Systemd Service

Create `/etc/systemd/system/domaintenance.service`:

```ini
[Unit]
Description=DoMaintenance backend
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/opt/domaintenance
EnvironmentFile=/opt/domaintenance/.env
ExecStart=/opt/domaintenance/backend
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable and start it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable domaintenance
sudo systemctl start domaintenance
sudo systemctl status domaintenance
```

### Step 5: Configure Nginx

Create `/etc/nginx/sites-available/domaintenance`:

```nginx
# Frontend - domains.example.com
server {
    listen 80;
    listen [::]:80;
    server_name domains.example.com;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        return 301 https://$server_name$request_uri;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name domains.example.com;

    root /var/www/domaintenance;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}

# Backend API - api.example.com
server {
    listen 80;
    listen [::]:80;
    server_name api.example.com;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        return 301 https://$server_name$request_uri;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name api.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/domaintenance /etc/nginx/sites-enabled/domaintenance
sudo nginx -t
sudo systemctl reload nginx
```

If you use HTTPS, obtain a certificate after the site is reachable:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d domains.example.com -d api.example.com
```

### Step 6: Access Application

Open:

```text
https://domains.example.com
```

The first registered user becomes the admin for a fresh install.

---

## Backup and Restore

The admin settings page supports exporting and importing a real backup package.

### Export

- Export creates a zip archive
- The archive contains:
  - `database.sql`
  - `favicons/domains/...`
  - `favicons/registrars/...`

### Import

- The package is validated before restore starts
- The current database is cleared
- `database.sql` is restored with `psql`
- Favicon files are restored afterward
- Runtime settings and cached currency data are reloaded
- The current user is signed out after restore

Because this flow uses real PostgreSQL tools, `pg_dump` and `psql` must exist on the server.

---

## Notes About Domain Lookups

- RDAP is used by default
- `.mk` uses `whois.marnet.mk`
- `.se` uses `whois.iis.se`
- `.cy` does not use automated refresh and should be entered manually
- WHOIS/RDAP refresh updates dates only
- Favicons are intentionally refreshed separately

---

