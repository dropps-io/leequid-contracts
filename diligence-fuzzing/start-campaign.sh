#!/bin/bash

# Exit the script if any command fails
set -e

# Change directory to parent directory of this script
cd "$(dirname "${BASH_SOURCE[0]}")/.."

ENV_FILE=".env"

# Check if .env file exists
if [ -f "$ENV_FILE" ]; then
    # Check if the .env file contains an environment variable called FUZZ_API_KEY
    if grep -q "FUZZ_API_KEY" "$ENV_FILE"; then
        echo "FUZZ_API_KEY is defined in the .env file."

        # Run Docker build
        docker build . --file diligence-fuzzing/docker/Dockerfile --build-arg BUILDKIT_INLINE_CACHE=1 -t fuzzcli

        # Run Docker container
        docker run --rm --env-file "$ENV_FILE" -t fuzzcli
    else
        echo "FUZZ_API_KEY is not defined in the .env file."
    fi
else
    echo "The .env file does not exist."
fi