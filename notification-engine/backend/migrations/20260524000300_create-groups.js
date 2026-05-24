export const up = async (pgm) => {
  pgm.createTable('groups', {
    id: { type: 'text', primaryKey: true },
    name: { type: 'text', notNull: true, unique: true },
    description: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
};

export const down = async (pgm) => {
  pgm.dropTable('groups');
};
