/**
 * Shared utilities for loading default/user items from directories.
 * Used by agents, workflows, commands, and skills registries.
 */

import { readdir, readFile, access, writeFile, mkdir, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { constants } from 'node:fs'
import matter from 'gray-matter'
import { logger } from '../utils/logger.js'

export async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.R_OK)
    return true
  } catch {
    return false
  }
}

export async function getDefaultIds(dir: string, extension: string): Promise<string[]> {
  try {
    const files = (await readdir(dir)).filter((f) => f.endsWith(extension))
    return files.map((f) => f.replace(extension, ''))
  } catch {
    return []
  }
}

export interface ItemDefinition<T extends { id: string } = { id: string }> {
  metadata: T
  prompt: string
}

export interface ItemLoaderOptions {
  extension: string
  logName: string
}

export async function loadItemsFromDir<T extends ItemDefinition>(
  dir: string,
  options: ItemLoaderOptions,
): Promise<T[]> {
  if (!(await pathExists(dir))) {
    return []
  }
  let files: string[]
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith(options.extension))
  } catch {
    return []
  }
  const items: T[] = []
  for (const file of files) {
    try {
      const raw = await readFile(join(dir, file), 'utf-8')
      const { data, content } = matter(raw)
      if ((data as { id?: string }).id && content.trim()) {
        items.push({
          metadata: data as T['metadata'],
          prompt: content.trim(),
        } as T)
      } else {
        logger.warn(`Skipping invalid ${options.logName} file`, { file })
      }
    } catch (err) {
      logger.warn(`Failed to parse ${options.logName} file`, {
        file,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }
  return items
}

/**
 * Scan a directory for a file whose internal metadata.id matches the given id.
 * Returns the full path to the matching file, or null if not found.
 * Uses JSON.parse for JSON files, gray-matter for markdown files with frontmatter.
 */
export async function findFileByInternalId(dir: string, id: string, ext: string): Promise<string | null> {
  if (!(await pathExists(dir))) return null
  let files: string[]
  try {
    files = await readdir(dir)
  } catch {
    return null
  }
  for (const file of files) {
    if (!file.endsWith(ext)) continue
    try {
      const raw = await readFile(join(dir, file), 'utf-8')
      let parsedId: string | undefined
      if (ext === '.md' || ext === '.mdx') {
        const { data } = matter(raw)
        parsedId = (data as { id?: string }).id
      } else {
        const parsed = JSON.parse(raw)
        parsedId = parsed.metadata?.id ?? parsed.id
      }
      if (parsedId === id) {
        return join(dir, file)
      }
    } catch {
      // skip unparseable files
    }
  }
  return null
}

export async function saveItemToDir<T>(
  dir: string,
  item: T,
  ext: string,
  serialize: (item: T) => string,
): Promise<void> {
  if (!(await pathExists(dir))) {
    await mkdir(dir, { recursive: true })
  }
  const meta = (item as { metadata: { id: string } }).metadata
  const filePath = join(dir, `${meta.id}${ext}`)

  // If a file with a different name but same internal ID exists, remove it first
  // to prevent duplicates when filename ≠ ID (e.g. pr-review.workflow.json vs review.workflow.json)
  const existing = await findFileByInternalId(dir, meta.id, ext)
  if (existing && existing !== filePath) {
    await unlink(existing).catch(() => {})
  }

  await writeFile(filePath, serialize(item), 'utf-8')
}

export const jsonSerializer = <T>(item: T): string => JSON.stringify(item, null, 2) + '\n'

export async function deleteItemFromDir(dir: string, id: string, ext: string): Promise<{ success: boolean }> {
  // First try the fast path: {id}{ext}
  const fastPath = join(dir, `${id}${ext}`)
  try {
    await unlink(fastPath)
    return { success: true }
  } catch {
    // Fast path failed — try to find by internal ID
    const found = await findFileByInternalId(dir, id, ext)
    if (found) {
      try {
        await unlink(found)
        return { success: true }
      } catch {
        return { success: false }
      }
    }
    return { success: false }
  }
}
