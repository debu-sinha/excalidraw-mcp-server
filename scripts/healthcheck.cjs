#!/usr/bin/env node
'use strict';

const url = process.env.CANVAS_SERVER_URL || 'http://127.0.0.1:3000';

fetch(`${url}/health`)
  .then(res => {
    if (!res.ok) {
      console.error(`Health check failed: ${res.status}`);
      process.exit(1);
    }
    return res.json();
  })
  .then(data => {
    console.log(`Status: ${data.status}`);
    process.exit(0);
  })
  .catch(err => {
    console.error(`Health check error: ${err.message}`);
    process.exit(1);
  });
