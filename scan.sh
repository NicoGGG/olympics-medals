#!/bin/bash

dir_name=$(dirname ${BASH_SOURCE[0]})
echo $(date)
/home/ubuntu/.nvm/versions/node/v20.16.0/bin/node $dir_name/index.js
