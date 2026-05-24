export const up = async (pgm) => {
  pgm.createTable('templates', {
    id: { type: 'text', primaryKey: true },
    name: { type: 'text', notNull: true },
    kind: { type: 'text', notNull: true },
    body: { type: 'text', notNull: true },
    vars_schema: { type: 'jsonb' },
    version: { type: 'integer', notNull: true, default: 1 },
    active: { type: 'boolean', notNull: true, default: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint(
    'templates',
    'templates_kind_check',
    "CHECK (kind IN ('text_html', 'image', 'adaptive_card'))"
  );
};

export const down = async (pgm) => {
  pgm.dropTable('templates');
};
