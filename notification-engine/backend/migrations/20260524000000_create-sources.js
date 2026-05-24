export const up = async (pgm) => {
  pgm.createTable('sources', {
    id: { type: 'text', primaryKey: true },
    name: { type: 'text', notNull: true },
    api_key_hash: { type: 'text', notNull: true },
    api_key_prefix: { type: 'text', notNull: true },
    rate_limit_rpm: { type: 'integer', notNull: true, default: 60 },
    active: { type: 'boolean', notNull: true, default: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    last_used_at: { type: 'timestamptz' },
  });
};

export const down = async (pgm) => {
  pgm.dropTable('sources');
};
