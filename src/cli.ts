#!/usr/bin/env bun

import { BrainDB } from './core/db.js';

// 全局参数解析
function parseArgs(args: string[]): { command: string; args: string[]; flags: Record<string, string> } {
  const flags: Record<string, string> = {};
  const commandArgs: string[] = [];
  let command = '';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg.startsWith('--')) {
      // 处理标志
      const eqIndex = arg.indexOf('=');
      if (eqIndex !== -1) {
        // --flag=value 格式
        flags[arg.slice(2, eqIndex)] = arg.slice(eqIndex + 1);
      } else {
        // --flag 格式，下一个参数是值
        const key = arg.slice(2);
        if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
          flags[key] = args[i + 1];
          i++;
        } else {
          flags[key] = 'true';
        }
      }
    } else if (!command) {
      // 第一个非标志参数是命令
      command = arg;
    } else {
      // 其他参数
      commandArgs.push(arg);
    }
  }

  return { command, args: commandArgs, flags };
}

// 获取数据库路径
function getDbPath(flags: Record<string, string>): string {
  return flags.db || flags['db-path'] || process.env.GBRAIN_DB || './brain.db';
}

// 命令处理器类型
type CommandHandler = (args: string[], flags: Record<string, string>, db: BrainDB) => Promise<void>;

// 命令映射
const commands: Record<string, CommandHandler> = {
  'init': async (args, flags, db) => {
    const initCmd = await import('./commands/init.js');
    await initCmd.default(args, flags, db);
  },
  'get': async (args, flags, db) => {
    const getCmd = await import('./commands/get.js');
    await getCmd.default(args, flags, db);
  },
  'put': async (args, flags, db) => {
    const putCmd = await import('./commands/put.js');
    await putCmd.default(args, flags, db);
  },
  'list': async (args, flags, db) => {
    const listCmd = await import('./commands/list.js');
    await listCmd.default(args, flags, db);
  },
  'stats': async (args, flags, db) => {
    const statsCmd = await import('./commands/stats.js');
    await statsCmd.default(args, flags, db);
  },
  'tags': async (args, flags, db) => {
    const tagsCmd = await import('./commands/tags.js');
    await tagsCmd.default(args, flags, db);
  },
  'tag': async (args, flags, db) => {
    const tagCmd = await import('./commands/tag.js');
    await tagCmd.default(args, flags, db);
  },
  'untag': async (args, flags, db) => {
    const untagCmd = await import('./commands/untag.js');
    await untagCmd.default(args, flags, db);
  },
  'link': async (args, flags, db) => {
    const linkCmd = await import('./commands/link.js');
    await linkCmd.default(args, flags, db);
  },
  'unlink': async (args, flags, db) => {
    const unlinkCmd = await import('./commands/unlink.js');
    await unlinkCmd.default(args, flags, db);
  },
  'backlinks': async (args, flags, db) => {
    const backlinksCmd = await import('./commands/backlinks.js');
    await backlinksCmd.default(args, flags, db);
  },
  'timeline': async (args, flags, db) => {
    const timelineCmd = await import('./commands/timeline.js');
    await timelineCmd.default(args, flags, db);
  },
  'timeline-add': async (args, flags, db) => {
    const timelineAddCmd = await import('./commands/timeline-add.js');
    await timelineAddCmd.default(args, flags, db);
  },
  'search': async (args, flags, db) => {
    const searchCmd = await import('./commands/search.js');
    await searchCmd.default(args, flags, db);
  },
  'query': async (args, flags, db) => {
    const queryCmd = await import('./commands/query.js');
    await queryCmd.default(args, flags, db);
  },
  'embed': async (args, flags, db) => {
    const embedCmd = await import('./commands/embed.js');
    await embedCmd.default(args, flags, db);
  },
  'import': async (args, flags, db) => {
    const importCmd = await import('./commands/import.js');
    await importCmd.default(args, flags, db);
  },
  'export': async (args, flags, db) => {
    const exportCmd = await import('./commands/export.js');
    await exportCmd.default(args, flags, db);
  },
  'serve': async (args, flags, db) => {
    const serveCmd = await import('./commands/serve.js');
    await serveCmd.default(args, flags, db);
  },
  'call': async (args, flags, db) => {
    const callCmd = await import('./commands/call.js');
    await callCmd.default(args, flags, db);
  },
  'config': async (args, flags, db) => {
    const configCmd = await import('./commands/config.js');
    await configCmd.default(args, flags, db);
  },
  'version': async (args, flags, db) => {
    console.log('gbrain v0.1.0');
  },
};

async function main() {
  const args = process.argv.slice(2);
  const { command, args: commandArgs, flags } = parseArgs(args);

  // 显示帮助
  if (!command || command === 'help' || flags.help) {
    console.log('gbrain - A CLI tool for personal knowledge management');
    console.log('');
    console.log('Usage: gbrain <command> [args...] [--flags]');
    console.log('');
    console.log('Commands:');
    console.log('  init [path]              Create a new brain database');
    console.log('  get <slug>              Read a page');
    console.log('  put <slug>              Write/update a page');
    console.log('  list [--type] [--tag]   List pages');
    console.log('  stats                   Show statistics');
    console.log('  tags <slug>             List tags for a page');
    console.log('  tag <slug> <tag>       Add a tag');
    console.log('  untag <slug> <tag>     Remove a tag');
    console.log('  link <from> <to>        Create a link');
    console.log('  unlink <from> <to>      Remove a link');
    console.log('  backlinks <slug>       Show backlinks');
    console.log('  timeline <slug>        Show timeline');
    console.log('  timeline-add <slug>    Add timeline entry');
    console.log('  search <query>         Full-text search');
    console.log('  query <question>        Hybrid search');
    console.log('  embed [--all]          Generate embeddings');
    console.log('  import <dir>           Import from markdown');
    console.log('  export [--dir]         Export to markdown');
    console.log('  serve                  Start MCP server');
    console.log('  call <tool> <json>     Raw tool call');
    console.log('  config <key> [value]    Get/set config');
    console.log('  version                Show version');
    console.log('');
    console.log('Global flags:');
    console.log('  --db <path>             Specify database path');
    console.log('  --json                  Output as JSON');
    process.exit(0);
  }

  // 特殊处理 init 命令（不需要现有数据库）
  if (command === 'init') {
    const initCmd = await import('./commands/init.js');
    await initCmd.default(commandArgs, flags, null as any);
    return;
  }

  // 获取数据库路径并连接
  const dbPath = getDbPath(flags);
  let db: BrainDB;
  
  try {
    db = new BrainDB(dbPath);
  } catch (error) {
    console.error(`Error opening database: ${dbPath}`);
    console.error(error);
    process.exit(1);
  }

  // 查找并执行命令
  const handler = commands[command];
  
  if (!handler) {
    console.error(`Unknown command: ${command}`);
    console.error('Run "gbrain help" for usage information');
    process.exit(1);
  }

  try {
    await handler(commandArgs, flags, db);
  } catch (error) {
    console.error(`Error executing command: ${command}`);
    console.error(error);
    process.exit(1);
  } finally {
    db.close();
  }
}

main();
