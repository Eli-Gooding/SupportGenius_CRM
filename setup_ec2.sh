#!/bin/bash

# Update package lists
echo "Updating package lists..."
sudo apt-get update
sudo apt-get upgrade -y

# Install Node.js and npm
echo "Installing Node.js and npm..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install git
echo "Installing git..."
sudo apt-get install -y git

# Install build essentials (needed for some npm packages)
echo "Installing build essentials..."
sudo apt-get install -y build-essential

# Verify installations
echo "Verifying installations..."
node --version
npm --version
git --version

# Set npm to use legacy peer deps (for compatibility)
echo "Configuring npm..."
npm config set legacy-peer-deps true

# Create app directory
echo "Setting up application directory..."
mkdir -p /home/ubuntu/app
cd /home/ubuntu/app

# Note: You should git clone your repository here
# git clone <your-repository-url>

# Install project dependencies
echo "Installing project dependencies..."
npm install

echo "Setup complete! Next steps:"
echo "1. Clone your repository"
echo "2. Set up your .env file"
echo "3. Build and start the application with 'npm run build && npm start'" 