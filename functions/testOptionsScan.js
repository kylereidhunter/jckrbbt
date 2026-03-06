// functions/testOptionsScan.js
// Run with: node testOptionsScan.js
// Make sure you're in the functions/ directory

require('dotenv').config();
const admin = require('firebase-admin');
admin.initializeApp();

const { _runOptionsFlowScan } = require('./optionsFlowScanner');

console.log('🚀 Starting manual options flow scan...\n');

_runOptionsFlowScan()
  .then(result => {
    console.log('\n✅ DONE:', JSON.stringify(result, null, 2));
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ FAILED:', err);
    process.exit(1);
  });
