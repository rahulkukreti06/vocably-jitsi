# Vocably WebSocket Server Deployment Guide

## VPS Deployment Steps

### 1. Connect to your VPS
```bash
ssh rahul@173.249.22.208
```

### 2. Install Node.js (if not already installed)
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt-get install -y nodejs
```

### 3. Create project directory
```bash
mkdir -p /home/rahul/vocably-ws
cd /home/rahul/vocably-ws
```

### 4. Copy your files to VPS
You need to copy these files to your VPS:
- `server/ws.js`
- `server/package.json`
- `.env.local` (copy as `.env`)

### 5. Install dependencies on VPS
```bash
npm install
```

### 6. Create systemd service for auto-start
Create `/etc/systemd/system/vocably-ws.service`:
```ini
[Unit]
Description=Vocably WebSocket Server
After=network.target

[Service]
Type=simple
User=rahul
WorkingDirectory=/home/rahul/vocably-ws
ExecStart=/usr/bin/node ws.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=WS_PORT=3001
Environment=WS_HOST=0.0.0.0

[Install]
WantedBy=multi-user.target
```

### 7. Start the service
```bash
systemctl daemon-reload
systemctl enable vocably-ws
systemctl start vocably-ws
systemctl status vocably-ws
```

### 8. Configure firewall
```bash
# Allow port 3001 for WebSocket connections
ufw allow 3001/tcp
```

### 9. Test the connection
From your local machine, test if the WebSocket server is accessible:
```bash
# You can use a WebSocket testing tool or browser console
# Try connecting to: ws://173.249.22.208:3001
```

## Environment Variables for VPS

Create a `.env` file in `/home/rahul/vocably-ws/` with your Supabase credentials:
```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
WS_PORT=3001
WS_HOST=0.0.0.0
```

## Quick Deploy Script

You can use this script to quickly copy files to your VPS:

```bash
#!/bin/bash
# Run this from your local project directory

# Copy server files
scp server/ws.js rahul@173.249.22.208:/home/rahul/vocably-ws/
scp server/package.json rahul@173.249.22.208:/home/rahul/vocably-ws/
scp .env.local rahul@173.249.22.208:/home/rahul/vocably-ws/.env

# SSH and install
ssh rahul@173.249.22.208 << 'EOF'
cd /home/rahul/vocably-ws
npm install
systemctl restart vocably-ws
systemctl status vocably-ws
EOF
```

## Monitoring

Check if the service is running:
```bash
systemctl status vocably-ws
journalctl -u vocably-ws -f  # View live logs
```
