export const up = async (pgm) => {
  pgm.createTable('notification_deliveries', {
    id: { type: 'text', primaryKey: true },
    notification_id: {
      type: 'text',
      notNull: true,
      references: 'notifications(id)',
      onDelete: 'CASCADE',
    },
    rule_id: {
      type: 'text',
      references: 'routing_rules(id)',
      onDelete: 'SET NULL',
    },
    group_id: {
      type: 'text',
      references: '"groups"(id)',
      onDelete: 'SET NULL',
    },
    recipient_type: { type: 'text', notNull: true },
    recipient_id: { type: 'text', notNull: true },
    status: { type: 'text', notNull: true },
    attempts: { type: 'integer', notNull: true, default: 0 },
    last_error: { type: 'text' },
    graph_chat_id: { type: 'text' },
    graph_message_id: { type: 'text' },
    sent_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint(
    'notification_deliveries',
    'notification_deliveries_recipient_type_check',
    "CHECK (recipient_type IN ('user', 'channel'))"
  );
  pgm.addConstraint(
    'notification_deliveries',
    'notification_deliveries_status_check',
    "CHECK (status IN ('queued', 'sent', 'failed', 'retrying'))"
  );
  pgm.createIndex('notification_deliveries', 'notification_id');
  pgm.createIndex('notification_deliveries', 'status');
  pgm.createIndex('notification_deliveries', ['created_at']);
};

export const down = async (pgm) => {
  pgm.dropTable('notification_deliveries');
};
