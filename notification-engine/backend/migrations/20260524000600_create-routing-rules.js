export const up = async (pgm) => {
  pgm.createTable('routing_rules', {
    id: { type: 'text', primaryKey: true },
    source_id: {
      type: 'text',
      notNull: true,
      references: 'sources(id)',
      onDelete: 'CASCADE',
    },
    event_pattern: { type: 'text', notNull: true },
    group_id: {
      type: 'text',
      notNull: true,
      references: '"groups"(id)',
      onDelete: 'RESTRICT',
    },
    template_id: {
      type: 'text',
      references: 'templates(id)',
      onDelete: 'SET NULL',
    },
    priority: { type: 'integer', notNull: true, default: 100 },
    active: { type: 'boolean', notNull: true, default: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
};

export const down = async (pgm) => {
  pgm.dropTable('routing_rules');
};
