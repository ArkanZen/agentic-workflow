import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { listChanges, readProposalContent } from './openspec.js';

let tempRoot;

async function createTempRoot() {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'workflow-openspec-'));
  return tempRoot;
}

afterEach(async () => {
  if (tempRoot) {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

describe('listChanges', () => {
  it('有归档变更时返回列表', async () => {
    const root = await createTempRoot();
    const archiveDir = path.join(root, 'openspec', 'changes', 'archive');
    const changeDir = path.join(archiveDir, '2026-06-01-my-change');
    await fs.mkdir(changeDir, { recursive: true });
    await fs.writeFile(path.join(changeDir, 'proposal.md'), '# My Change\n\nSome content.');

    const result = await listChanges(root);

    expect(result.available).toBe(true);
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0].id).toBe('2026-06-01-my-change');
    expect(result.changes[0].title).toBe('My Change');
  });

  it('archive 目录为空时返回空列表', async () => {
    const root = await createTempRoot();
    const archiveDir = path.join(root, 'openspec', 'changes', 'archive');
    await fs.mkdir(archiveDir, { recursive: true });

    const result = await listChanges(root);

    expect(result.available).toBe(false);
    expect(result.changes).toHaveLength(0);
  });

  it('archive 目录不存在时返回空列表', async () => {
    const root = await createTempRoot();

    const result = await listChanges(root);

    expect(result.available).toBe(false);
    expect(result.changes).toHaveLength(0);
  });
});

describe('readProposalContent', () => {
  it('有效 changeId 且 proposal 存在时返回内容', async () => {
    const root = await createTempRoot();
    const archiveDir = path.join(root, 'openspec', 'changes', 'archive');
    const changeDir = path.join(archiveDir, '2026-06-01-my-change');
    await fs.mkdir(changeDir, { recursive: true });
    await fs.writeFile(path.join(changeDir, 'proposal.md'), '# My Change\n\nContent here.');

    const result = await readProposalContent('2026-06-01-my-change', root);

    expect(result).toBe('# My Change\n\nContent here.');
  });

  it('proposal 不存在时返回 null', async () => {
    const root = await createTempRoot();
    const archiveDir = path.join(root, 'openspec', 'changes', 'archive', '2026-06-01-my-change');
    await fs.mkdir(archiveDir, { recursive: true });

    const result = await readProposalContent('2026-06-01-my-change', root);

    expect(result).toBeNull();
  });

  it('路径穿越攻击时返回 null', async () => {
    const root = await createTempRoot();
    await fs.writeFile(path.join(root, 'secret.txt'), 'secret');

    const result = await readProposalContent('../../secret', root);

    expect(result).toBeNull();
  });
});
