#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const key = crypto.randomBytes(32).toString('hex');
console.log(key);
