import { BrainDB } from '../core/db.js';
import * as fs from 'fs';

export default async function init(args: string[], flags: Record<string, string>, db: BrainDB | null): Promise<void> {
  const dbPath = args[0] || flags.db || flags['db-path'] || process.env.GBRAIN_DB || './brain.db';

  // 检查文件是否已存在
  if (fs.existsSync(dbPath)) {
    console.error(`Error: Database already exists at ${dbPath}`);
    console.error('Use a different path or delete the existing database first.');
    process.exit(1);
  }

  try {
    // 创建新数据库（BrainDB 构造函数会自动初始化 Schema）
    const newDb = new BrainDB(dbPath);
    newDb.close();

    console.log(`Initialized new brain database at ${dbPath}`);
  } catch (error) {
    console.error(`Error initializing database: ${error}`);
    process.exit(1);
  }
}
