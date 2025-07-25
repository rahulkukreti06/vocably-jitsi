#!/bin/bash

# Vocably WebSocket Server Deployment Script
# Run this from your vocably-jitsi project root directory

VPS_IP="173.249.22.208"
VPS_USER="rahul"
DEPLOY_PATH="/home/rahul/vocably-ws"

echo "🚀 Deploying Vocably WebSocket Server to VPS..."

# Create deployment directory on VPS
echo "📁 Creating deployment directory..."
ssh $VPS_USER@$VPS_IP "mkdir -p $DEPLOY_PATH"

# Copy server files
echo "📤 Copying server files..."
scp server/ws.js $VPS_USER@$VPS_IP:$DEPLOY_PATH/
scp server/package.json $VPS_USER@$VPS_IP:$DEPLOY_PATH/
scp .env.local $VPS_USER@$VPS_IP:$DEPLOY_PATH/.env

# Install dependencies and start service
echo "⚙️ Installing dependencies and starting service..."
ssh $VPS_USER@$VPS_IP << EOF
cd $DEPLOY_PATH
npm install

# Create systemd service file
cat > /etc/systemd/system/vocably-ws.service << 'EOL'
[Unit]
Description=Vocably WebSocket Server
After=network.target

[Service]
Type=simple
User=rahul
WorkingDirectory=$DEPLOY_PATH
ExecStart=/usr/bin/node ws.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=WS_PORT=3001
Environment=WS_HOST=0.0.0.0

[Install]
WantedBy=multi-user.target
EOL

# Enable and start the service
systemctl daemon-reload
systemctl enable vocably-ws
systemctl restart vocably-ws

# Open firewall port
ufw allow 3001/tcp

echo "✅ WebSocket server deployed successfully!"
echo "🔍 Service status:"
systemctl status vocably-ws --no-pager
EOF

echo "🎉 Deployment complete!"
echo "🌐 Your WebSocket server should now be accessible at: ws://$VPS_IP:3001"
echo "📋 To check logs: ssh $VPS_USER@$VPS_IP 'journalctl -u vocably-ws -f'"
