import { retrieveKnowledge } from './retrieve.js';

describe('knowledge retrieve P1-A', () => {
  it('pathname boost: generic query with /admin/pricing ranks pricing chunk first', () => {
    const chunks = retrieveKnowledge('hvordan?', 'admin', '/admin/pricing');
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0]?.id).toBe('pricing');
  });

  it('synonym: query "order" finds orders chunk', () => {
    const chunks = retrieveKnowledge('order', 'admin');
    expect(chunks.map((c) => c.id)).toContain('orders');
  });

  it('synonym: query "statistics" finds statistikk chunk', () => {
    const chunks = retrieveKnowledge('statistics', 'admin');
    expect(chunks.map((c) => c.id)).toContain('statistics');
  });

  it('role filter intact: kunde cannot see admin-only pricing chunk', () => {
    const chunks = retrieveKnowledge('pris', 'kunde');
    expect(chunks.map((c) => c.id)).not.toContain('pricing');
  });

  it('empty query returns first 4 role-visible chunks', () => {
    const chunks = retrieveKnowledge('', 'admin');
    expect(chunks).toHaveLength(4);
    const kundeChunks = retrieveKnowledge('  ???  ', 'kunde');
    expect(kundeChunks).toHaveLength(4);
  });
});
