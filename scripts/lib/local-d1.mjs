import { DatabaseSync } from 'node:sqlite';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

export async function localD1(filename = ':memory:') {
  const sqlite = new DatabaseSync(filename);
  sqlite.exec('PRAGMA foreign_keys = ON; CREATE TABLE IF NOT EXISTS local_migrations (name TEXT PRIMARY KEY);');
  const root = resolve(import.meta.dirname,'../..');
  for (const name of (await readdir(resolve(root,'drizzle'))).filter(name=>name.endsWith('.sql')).sort()) {
    if (sqlite.prepare('SELECT name FROM local_migrations WHERE name=?').get(name)) continue;
    sqlite.exec('BEGIN');
    try { sqlite.exec(await readFile(resolve(root,'drizzle',name),'utf8')); sqlite.prepare('INSERT INTO local_migrations VALUES (?)').run(name); sqlite.exec('COMMIT'); }
    catch(error) { sqlite.exec('ROLLBACK'); throw error; }
  }
  const prepare = (sql, values=[]) => ({
    bind(...next){return prepare(sql,next);},
    async first(column){const row=sqlite.prepare(sql).get(...values)||null;return column&&row?row[column]:row;},
    async all(){return {success:true,results:sqlite.prepare(sql).all(...values)};},
    async run(){const result=sqlite.prepare(sql).run(...values);return {success:true,meta:{changes:result.changes,last_row_id:result.lastInsertRowid}};},
    _sql:sql,_values:values
  });
  return {prepare,async batch(statements){sqlite.exec('BEGIN');try {const results=statements.map(x=>({success:true,results:sqlite.prepare(x._sql).all(...x._values)}));sqlite.exec('COMMIT');return results;}catch(error){sqlite.exec('ROLLBACK');throw error;}},close(){sqlite.close();},sqlite};
}
