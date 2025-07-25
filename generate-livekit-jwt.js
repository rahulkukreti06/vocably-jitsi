const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

// Read .env.local
const envPath = path.join(__dirname, '.env.local');
const env = fs.readFileSync(envPath, 'utf-8');
const lines = env.split('\n');
let apiKey = '';
let apiSecret = '';
// This file is now deprecated. Jitsi does not require JWT generation for basic usage.
console.log('Jitsi does not require custom JWT generation for joining rooms.');