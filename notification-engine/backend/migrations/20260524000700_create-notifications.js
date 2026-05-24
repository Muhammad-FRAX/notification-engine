export const up = async (pgm) => {
  pgm.createTable('notifications', {
    id: { type: 'text', primaryKey: true },
    source_id: {
      type: 'text',
      references: 'sources(id)',
      onDelete: 'SET NULL',
    },
    event_type: { type: 'text', notNull: true },
    payload: { type: 'jsonb', notNull: true },
    received_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    status: { type: 'text', notNull: true },
    matched_rules: { type: 'jsonb' },
    recipient_count: { type: 'integer', notNull: true, default: 0 },
    error: { type: 'text' },
  });
  pgm.addConstraint(
    'notifications',
    'notifications_status_check',
    "CHECK (status IN ('queued', 'sending', 'sent', 'partial', 'failed', 'unrouted'))"
  );
};

export const down = async (pgm) => {
  pgm.dropTable('notifications');
};
