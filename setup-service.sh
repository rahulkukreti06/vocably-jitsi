#!/bin/bash

# Setup systemd service for Vocably WebSocket server
echo "Setting up Vocably WebSocket systemd service..."

# Create the service file
sudo tee /etc/systemd/system/vocably-ws.service > /dev/null << 'EOF'
[Unit]
Description=Vocably WebSocket Service
After=network.target

[Service]
Type=simple
User=rahul
WorkingDirectory=/home/rahul/server
ExecStart=/usr/bin/node ws.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd to recognize the new service
sudo systemctl daemon-reload

# Enable the service to start automatically on boot
sudo systemctl enable vocably-ws.service

# Stop the current nohup process if running
pkill -f "node ws.js"

# Start the service
sudo systemctl start vocably-ws.service

# Check service status
sudo systemctl status vocably-ws.service

echo "Setup complete! Your WebSocket server will now:"
echo "1. Start automatically when the server boots"
echo "2. Restart automatically if it crashes"
echo "3. Continue running even after you close SSH"
echo ""
echo "Service management commands:"
echo "- Check status: sudo systemctl status vocably-ws.service"
echo "- Start service: sudo systemctl start vocably-ws.service"
echo "- Stop service: sudo systemctl stop vocably-ws.service"
echo "- Restart service: sudo systemctl restart vocably-ws.service"
echo "- View logs: sudo journalctl -u vocably-ws.service -f"
