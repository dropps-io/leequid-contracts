#!/bin/bash

# Clean up artifacts
rm -rf artifacts

# Run fuzz arm command
fuzz arm --assert

# Run hardhat compile
yarn compile

# Stop any running hardhat node processes
pkill -f ".*hardhat node.*"

# Start hardhat node in the background and redirect output to /dev/null
nohup npx hardhat node > /dev/null 2>&1 &

# Wait for the hardhat node to start (you can adjust the sleep time as needed)
sleep 30

# Run your deploy script
npx hardhat run scripts/local/deploy-contracts.js --no-compile --network local

# Run the fuzz command
fuzz -c .fuzz.yml run --no-prompts
