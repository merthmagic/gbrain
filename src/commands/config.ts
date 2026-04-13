import { BrainDB } from '../core/db.js';

export default async function config(args: string[], flags: Record<string, string>, db: BrainDB): Promise<void> {
  if (args.length === 0) {
    // List all config
    const configs = db.getAllConfigs();
    if (flags.json) {
      console.log(JSON.stringify(configs, null, 2));
    } else {
      console.log('Configuration:');
      for (const [key, value] of Object.entries(configs)) {
        console.log(`  ${key}: ${value}`);
      }
    }
  } else if (args.length === 1) {
    // Get config value
    const key = args[0];
    const value = db.getConfig(key);
    if (flags.json) {
      console.log(JSON.stringify({ key, value }, null, 2));
    } else {
      console.log(`${key}: ${value}`);
    }
  } else if (args.length === 2) {
    // Set config value
    const key = args[0];
    const value = args[1];
    db.setConfig(key, value);
    if (flags.json) {
      console.log(JSON.stringify({ key, value, action: 'set' }, null, 2));
    } else {
      console.log(`Set ${key} = ${value}`);
    }
  } else {
    console.error('Error: Too many arguments');
    console.error('Usage: gbrain config [key] [value]');
    process.exit(1);
  }
}
