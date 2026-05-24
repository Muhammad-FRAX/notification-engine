export const up = async (pgm) => {
  pgm.createTable('recipients_users', {
    id: { type: 'text', primaryKey: true },
    display_name: { type: 'text', notNull: true },
    upn: { type: 'text', notNull: true, unique: true },
    aad_user_id: { type: 'text', unique: true },
    notes: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
};

export const down = async (pgm) => {
  pgm.dropTable('recipients_users');
};
