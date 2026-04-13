#!/usr/bin/env bun

const args = process.argv.slice(2);

if (args.includes('hello') || args.length === 0) {
  console.log('Hello from gbrain!');
} else if (args.includes('--version') || args.includes('-v')) {
  console.log('gbrain v0.1.0');
} else {
  console.log('Usage: gbrain [hello|--version]');
  console.log('  hello    Say hello');
  console.log('  --version Show version');
}
