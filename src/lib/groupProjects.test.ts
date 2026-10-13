import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchGroupProjects } from './groupProjects';

const db = vi.hoisted(() => ({ from: vi.fn(), eq: vi.fn(), in: vi.fn(), linkSelect: vi.fn(), projectSelect: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: db.from } }));

beforeEach(() => {
  vi.clearAllMocks();
  db.linkSelect.mockReturnValue({ eq: db.eq });
  db.projectSelect.mockReturnValue({ in: db.in });
  db.from.mockImplementation((table) => {
    if (table === 'project_groups') return { select: db.linkSelect };
    if (table === 'projects_browse') return { select: db.projectSelect };
    throw new Error(`Unexpected table: ${table}`);
  });
});

describe('group project browse', () => {
  it('loads only linked projects through the permitted browse projection', async () => {
    db.eq.mockResolvedValue({ data: [{ project_id: 'a' }, { project_id: 'b' }, { project_id: 'a' }], error: null });
    // An inaccessible linked project is filtered by the browse view.
    db.in.mockResolvedValue({ data: [{ id: 'a', title: 'Accessible project' }], error: null });
    expect(await fetchGroupProjects('group-a')).toEqual([{ id: 'a', title: 'Accessible project' }]);
    expect(db.linkSelect).toHaveBeenCalledWith('project_id');
    expect(db.eq).toHaveBeenCalledWith('group_id', 'group-a');
    expect(db.in).toHaveBeenCalledWith('id', ['a', 'b']);
    expect(db.projectSelect.mock.calls[0][0]).not.toContain('*');
  });

  it('does not query projects when membership filtering yields no links', async () => {
    db.eq.mockResolvedValue({ data: [], error: null });
    expect(await fetchGroupProjects('private-group')).toEqual([]);
    expect(db.projectSelect).not.toHaveBeenCalled();
  });

  it('propagates link permission errors without fetching projects', async () => {
    const error = { code: '42501', message: 'Permission denied' };
    db.eq.mockResolvedValue({ data: null, error });
    await expect(fetchGroupProjects('group-a')).rejects.toEqual(error);
    expect(db.projectSelect).not.toHaveBeenCalled();
  });

  it('propagates browse errors instead of silently hiding failed projects', async () => {
    const error = { message: 'Browse unavailable' };
    db.eq.mockResolvedValue({ data: [{ project_id: 'a' }], error: null });
    db.in.mockResolvedValue({ data: null, error });
    await expect(fetchGroupProjects('group-a')).rejects.toEqual(error);
  });
});
