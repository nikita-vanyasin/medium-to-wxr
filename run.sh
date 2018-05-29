#!/bin/bash

docker run --rm -v "$PWD":/usr/src/app -w /usr/src/app node "$@"
